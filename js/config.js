// ============================================================
// CONFIGURAÇÃO — edite APPS_SCRIPT_URL após publicar o script
// ============================================================

const CONFIG = {
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbz1u3RCkujoHYt3c1sGWdIN7W8wHNnS5AHeHarvhYV199etWu7NFNWpjKkgkiUOOfZwcA/exec',
  USERNAME: 'AndressaGS',
  PASSWORD: 'centrogs2025',
  CLINIC_NAME: 'Centro Clínico GS',
  // Usuário com acesso apenas ao estoque
  ESTOQUE_USERNAME: 'DouglasGS',
  ESTOQUE_PASSWORD: 'estoque2025'
};

// Tabela de repasse fixo para atendimentos Particulares
const PROCEDIMENTOS = [
  { nome: 'CONSULTA / PROFILAXIA / RASPAGEM',          repasse: 60   },
  { nome: 'CLAREAMENTO DE CONSULTÓRIO (por sessão)',    repasse: 200  },
  { nome: 'RESTAURAÇÃO',                               repasse: 55   },
  { nome: 'COROA EM PORCELANA',                        repasse: 250  },
  { nome: 'CANAL I/C/PM',                              repasse: 180  },
  { nome: 'CANAL M',                                   repasse: 300  },
  { nome: 'RETRATAMENTO I/C/PM',                       repasse: 210  },
  { nome: 'RETRATAMENTO M',                            repasse: 400  },
  { nome: 'PRÓTESE TOTAL',                             repasse: 300  },
  { nome: 'PPR',                                       repasse: 350  },
  { nome: 'COROA CEROMERO / ONLAY / INLAY',            repasse: 170  },
  { nome: 'IMPLANTE DENTÁRIO — CIRURGIA',              repasse: 400  },
  { nome: 'IMPLANTE — COROA',                          repasse: 400  },
  { nome: 'INTER CONSULTA IMPLANTE',                   repasse: 150  },
  { nome: 'EXTRAÇÃO SIMPLES',                          repasse: 75   },
  { nome: 'EXTRAÇÃO SISO',                             repasse: 120  },
  { nome: 'EXTRAÇÃO COMPLEXA',                         repasse: 200  },
  { nome: 'FACETAS PORCELANA (por dente)',              repasse: 350  },
  { nome: 'FACETAS RESINA (por dente)',                 repasse: 150  },
  { nome: 'PINO DE FIBRA DE VIDRO',                    repasse: 70   },
  { nome: 'PLACA MIORELAXANTE',                        repasse: 150  },
  { nome: 'PPA',                                       repasse: 170  },
  { nome: 'REMOÇÃO DE APARELHO ORTODÔNTICO',           repasse: 80   },
  { nome: 'PLACA DE CLAREAMENTO',                      repasse: 50   },
  { nome: 'SERINGA DE CLAREAMENTO',                    repasse: 30   },
  { nome: 'PROVISÓRIO',                                repasse: 75   },
  { nome: 'RECIMENTAÇÃO',                              repasse: 60   },
  { nome: 'MANTENEDOR',                                repasse: 90   },
  { nome: 'ENDO DECÍDUO',                              repasse: 120  },
  { nome: 'PROTOCOLO DE VERNIZ',                       repasse: 100  },
  { nome: 'SELANTE',                                   repasse: 40   }
];
