// Fuso horário fixo: agrupamentos por semana/mês e formatação de datas ficam determinísticos.
module.exports = () => {
  process.env.TZ = 'America/Sao_Paulo';
};
