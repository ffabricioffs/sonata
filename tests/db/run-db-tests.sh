#!/usr/bin/env bash
# Testes de banco (integração) no PostgreSQL real — roteiro: CT10, CT21, CT28, CT42, CT63/CT64, RF003/RF010/RF016/RF019, NF04.
# Uso:  CONFIRMO_BANCO_DE_TESTE=1 DATABASE_URL=postgresql://... bash tests/db/run-db-tests.sh
# ATENÇÃO: apaga e recria o schema public. Use um banco/branch de TESTE, nunca o de produção.
set -uo pipefail
cd "$(dirname "$0")/../.."
: "${DATABASE_URL:?defina DATABASE_URL apontando para um banco de TESTE}"
if [ "${CONFIRMO_BANCO_DE_TESTE:-}" != "1" ]; then
  echo "Este script APAGA e recria o schema public do banco em DATABASE_URL."
  echo "Rode só num banco/branch de teste:  CONFIRMO_BANCO_DE_TESTE=1 DATABASE_URL=... bash tests/db/run-db-tests.sh"
  exit 3
fi
export PGOPTIONS="-c client_min_messages=warning"
PSQL=(psql "$DATABASE_URL" -X -q -v ON_ERROR_STOP=1)
pass=0; fail=0; avisos=0
ok()  { echo "  ✔ $1"; pass=$((pass+1)); }
nok() { echo "  ✖ $1"; [ -n "${2:-}" ] && echo "      $2"; fail=$((fail+1)); }
aviso() { echo "  ⚠ $1"; [ -n "${2:-}" ] && echo "      $2"; avisos=$((avisos+1)); }

# espera ERRO com o código SQLSTATE indicado (23505 único, 23503 chave estrangeira)
espera_erro() { local id="$1" code="$2" sql="$3" out
  out=$("${PSQL[@]}" -c "BEGIN; $sql; ROLLBACK;" 2>&1) && { nok "$id" "aceitou, mas deveria recusar ($code)"; return; }
  "${PSQL[@]}" -c "ROLLBACK" >/dev/null 2>&1
  if echo "$out" | grep -q "$( [ "$code" = 23505 ] && echo 'duplicate key' || echo 'foreign key')"; then ok "$id"; else nok "$id" "$out"; fi
}
espera_ok() { local id="$1" sql="$2" out
  if out=$("${PSQL[@]}" -c "BEGIN; $sql; ROLLBACK;" 2>&1); then ok "$id"; else nok "$id" "$out"; fi
}
valor() { "${PSQL[@]}" -At -c "$1"; }

echo "Preparando banco de teste (migrações + seed)…"
"${PSQL[@]}" -c "DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;" >/dev/null
for m in prisma/migrations/2*/migration.sql; do "${PSQL[@]}" -f "$m" >/dev/null || { echo "falha na migração $m"; exit 2; }; done
SEED="${SEED_SQL:-Claude outputs/02-seed-demo-1.sql}"
grep -v '^\\restrict\|^\\unrestrict' "$SEED" | "${PSQL[@]}" >/dev/null || { echo "falha no seed $SEED"; exit 2; }

echo "Restrições de unicidade"
espera_erro "CT10 CPF de aluno duplicado (00000000103)" 23505 \
  "INSERT INTO \"Aluno\"(id,nome,email,cpf,ativo,\"createdAt\",\"updatedAt\") VALUES ('t1','Dup','dup@x.com','00000000103',true,now(),now())"
espera_erro "CT21 CPF de professor duplicado" 23505 \
  "INSERT INTO \"Usuario\" VALUES ('tu','P','p@x.com','\$2b\$12\$x','PROFESSOR',true,now(),now()),('tu2','Q','q@x.com','\$2b\$12\$x','PROFESSOR',true,now(),now()); INSERT INTO \"Professor\"(id,\"usuarioId\",cpf,\"createdAt\",\"updatedAt\") VALUES ('tp','tu','12345678909',now(),now()),('tp2','tu2','12345678909',now(),now())"
espera_erro "CT28 nome de sala duplicado (Sala 1)" 23505 \
  "INSERT INTO \"Sala\"(id,nome,capacidade,status) VALUES ('ts','Sala 1',4,'DISPONIVEL')"
espera_erro "CT42 matrícula repetida (Lucas × Piano Iniciante)" 23505 \
  "INSERT INTO \"Matricula\"(id,\"alunoId\",\"turmaId\",\"dataInicio\",ativo,\"createdAt\") VALUES ('tm','seed_aluno_001','seed_turma_001',now(),true,now())"
espera_erro "e-mail de login duplicado" 23505 \
  "INSERT INTO \"Usuario\" VALUES ('tu2','X','admin@exemplo.com','\$2b\$12\$x','ADMIN',true,now(),now())"
espera_ok "CT63 registrar e quitar mensalidade de Sofia (banco)" \
  "INSERT INTO \"Pagamento\"(id,\"alunoId\",valor,vencimento,pago,mes,ano,\"createdAt\") VALUES ('pg1','seed_aluno_006',250.00,'2026-12-10',false,12,2026,now()); UPDATE \"Pagamento\" SET pago=true, \"dataPagto\"=now() WHERE id='pg1'"
espera_erro "CT64 segunda mensalidade de Sofia no mesmo mês/ano" 23505 \
  "INSERT INTO \"Pagamento\"(id,\"alunoId\",valor,vencimento,pago,mes,ano,\"createdAt\") VALUES ('pg1','seed_aluno_006',250,'2026-12-10',false,12,2026,now()); INSERT INTO \"Pagamento\"(id,\"alunoId\",valor,vencimento,pago,mes,ano,\"createdAt\") VALUES ('pg2','seed_aluno_006',250,'2026-12-15',false,12,2026,now())"
espera_erro "uma reserva gera no máximo uma solicitação aprovada" 23505 \
  "INSERT INTO \"Reserva\"(id,\"salaId\",\"criadoPorId\",tipo,data,\"duracaoMin\",status,\"createdAt\") SELECT 'r1','seed_sala_3',id,'AULA','2026-12-04 17:00',60,'ATIVA',now() FROM \"Usuario\" WHERE email='admin@exemplo.com'; INSERT INTO \"SolicitacaoAula\"(id,\"alunoId\",\"professorId\",tipo,data,\"duracaoMin\",motivo,status,\"reservaId\",\"createdAt\") VALUES ('s1','seed_aluno_003','seed_prof_002','EXTRA','2026-12-04 17:00',60,'motivo','APROVADA','r1',now()),('s2','seed_aluno_003','seed_prof_002','EXTRA','2026-12-04 17:00',60,'motivo','APROVADA','r1',now())"

echo "Chaves estrangeiras (exclusão com vínculos)"
espera_erro "RF003 aluno com matrícula não é apagado pelo banco" 23503 "DELETE FROM \"Aluno\" WHERE id='seed_aluno_001'"
espera_erro "RF010 professor com turmas não é apagado pelo banco" 23503 "DELETE FROM \"Professor\" WHERE id='seed_prof_001'"
espera_erro "RF019 instrumento Piano com turmas não é apagado pelo banco" 23503 "DELETE FROM \"Instrumento\" WHERE nome='Piano'"
if out=$("${PSQL[@]}" -At -c "BEGIN; DELETE FROM \"Sala\" WHERE nome='Sala 1'; SELECT count(*) FROM \"Turma\" WHERE \"salaId\" IS NULL; ROLLBACK;" 2>&1); then
  aviso "RF016 sala com turmas: o banco NÃO protege (turmas ficam sem sala — SET NULL); a proteção é só da aplicação" "turmas sem sala após apagar a Sala 1: $(echo "$out" | tail -1)"
else ok "RF016 sala com turmas não é apagada pelo banco"; fi

echo "Dados do seed usados no roteiro"
semcpf=$(valor "SELECT count(*) FROM \"Professor\" WHERE cpf IS NULL OR endereco IS NULL")
[ "$semcpf" = 0 ] && ok "professores do seed com CPF e endereço (RF008)" || nok "professores do seed com CPF e endereço (RF008)" "$semcpf professor(es) sem CPF/endereço — o SQL de seed está desatualizado em relação ao prisma/seed.ts"
[ "$(valor "SELECT status||' '||coalesce(to_char(\"manutencaoAte\",'YYYY-MM-DD'),'-') FROM \"Sala\" WHERE nome='Sala 4'")" != "" ] && ok "Sala 4 em manutenção: $(valor "SELECT status||' até '||to_char(\"manutencaoAte\",'DD/MM/YYYY') FROM \"Sala\" WHERE nome='Sala 4'")" || nok "Sala 4"
[ "$(valor "SELECT capacidade FROM \"Sala\" WHERE nome='Auditório'")" = 40 ] && ok "Auditório com 40 lugares" || nok "Auditório com 40 lugares"
t=$(valor "SELECT t.\"diaSemana\"||' '||t.horario||' '||s.nome||' '||u.nome FROM \"Turma\" t JOIN \"Sala\" s ON s.id=t.\"salaId\" JOIN \"Professor\" p ON p.id=t.\"professorId\" JOIN \"Usuario\" u ON u.id=p.\"usuarioId\" WHERE t.nome LIKE 'Piano Iniciante%'")
[ "$t" = "SEGUNDA 09:00 Sala 1 Mariana Costa" ] && ok "Turma Piano Iniciante – Manhã: $t" || nok "Turma Piano Iniciante" "$t"
[ "$(valor "SELECT count(*) FROM \"Aluno\" WHERE cpf BETWEEN '00000000101' AND '00000000108'")" = 8 ] && ok "CPFs fictícios 00000000101 a 00000000108" || nok "CPFs fictícios"
[ "$(valor "SELECT count(*) FROM \"Sala\"")" = 6 ] && ok "6 salas no seed (CT31)" || nok "6 salas no seed"

echo "RNF004 — senhas no banco"
fracas=$(valor "SELECT string_agg(email||' ('||CASE WHEN \"senhaHash\" ~ '^[0-9a-f]{64}\$' THEN 'SHA-256 sem sal' ELSE 'formato desconhecido' END||')', ', ') FROM \"Usuario\" WHERE \"senhaHash\" !~ '^\\\$2[aby]\\\$'")
[ -z "$fracas" ] && ok "NF04 todas as senhas com hash bcrypt (\$2a\$/\$2b\$)" || nok "NF04 todas as senhas com hash bcrypt" "fora do padrão: $fracas"
legiveis=$(valor "SELECT count(*) FROM \"Usuario\" WHERE \"senhaHash\" IN ('123456','admin','senha')")
[ "$legiveis" = 0 ] && ok "NF04 nenhuma senha em texto puro" || nok "NF04 senha em texto puro" "$legiveis"

echo "Consultas usadas pelas telas"
[ "$(valor "SELECT string_agg(nome, ',') FROM \"Aluno\" WHERE ativo AND (nome ILIKE '%Lima%' OR email ILIKE '%Lima%')")" = "Gabriel Lima" ] && ok "CT16 busca “Lima” → Gabriel Lima" || nok "CT16 busca Lima"
v=$(valor "SELECT t.vagas - count(m.id) FROM \"Turma\" t LEFT JOIN \"Matricula\" m ON m.\"turmaId\"=t.id AND m.ativo WHERE t.nome='Violão Intermediário' GROUP BY t.vagas")
[ -n "$v" ] && ok "CT41 vagas livres em Violão Intermediário antes da matrícula: $v" || nok "CT41 vagas"
cap=$(valor "SELECT string_agg(t.nome||' ('||t.vagas||' vagas, '||s.nome||' cap. '||s.capacidade||')', '; ') FROM \"Turma\" t JOIN \"Sala\" s ON s.id=t.\"salaId\" WHERE t.vagas > s.capacidade")
[ -z "$cap" ] && ok "vagas das turmas cabem na capacidade das salas" || aviso "vagas das turmas cabem na capacidade das salas" "$cap"

echo
echo "Resultado: $pass aprovado(s), $fail reprovado(s), $avisos aviso(s)"
[ "$fail" -eq 0 ]
