export const manifest = {
  screens: {
    scr_00y356: { name: "Tableau de bord", route: "/", position: { "x": 160, "y": 220 } },
    scr_29w60n: { name: "Opportunités — cartes", route: "/opportunites", state: { "view": "cartes" }, position: { "x": 160, "y": 2200 } },
    scr_ytehel: { name: "Opportunités — tableau", route: "/opportunites", state: { "view": "tableau" }, position: { "x": 1560, "y": 2200 } },
    scr_398ajn: { name: "Détail d'une opportunité", route: "/opportunites/opp-1041", position: { "x": 2960, "y": 2200 } },
    scr_qa55iw: { name: "Candidatures — tableau", route: "/candidatures", state: { "view": "tableau" }, position: { "x": 160, "y": 4180 } },
    scr_rfxfd2: { name: "Candidatures — pipeline", route: "/candidatures", state: { "view": "pipeline" }, position: { "x": 1560, "y": 4180 } },
    scr_sp876p: { name: "Mes CV", route: "/cv", position: { "x": 160, "y": 6160 } },
    scr_3pl3zq: { name: "Choix du modèle", route: "/cv/modeles", position: { "x": 1560, "y": 6160 } },
    scr_612dys: { name: "Entretien vocal — écoute", route: "/cv/entretien", state: { "state": "ecoute" }, position: { "x": 160, "y": 8140 } },
    scr_32znqr: { name: "Entretien vocal — l'IA parle", route: "/cv/entretien", state: { "state": "ia_parle" }, position: { "x": 1560, "y": 8140 } },
    scr_9ddgkh: { name: "Entretien vocal — erreur", route: "/cv/entretien", state: { "state": "erreur" }, position: { "x": 2960, "y": 8140 } },
    scr_sukush: { name: "Entretien vocal — terminé", route: "/cv/entretien", state: { "state": "termine" }, position: { "x": 4360, "y": 8140 } },
    scr_92u9o2: { name: "Éditeur de CV — sections", route: "/cv/editeur", state: { "tab": "sections" }, position: { "x": 160, "y": 10120 } },
    scr_ni1dbv: { name: "Éditeur de CV — assistant IA", route: "/cv/editeur", state: { "tab": "assistant" }, position: { "x": 1560, "y": 10120 } },
    scr_lknz4u: { name: "Profil", route: "/profil", position: { "x": 160, "y": 12100 } },
    scr_ydswcb: { name: "Paramètres — compte", route: "/parametres", state: { "tab": "compte" }, position: { "x": 160, "y": 14080 } },
    scr_zw0vs1: { name: "Paramètres — automatisation", route: "/parametres", state: { "tab": "automatisation" }, position: { "x": 1560, "y": 14080 } },
    scr_bq4eoi: { name: "Paramètres — sources", route: "/parametres", state: { "tab": "sources" }, position: { "x": 2960, "y": 14080 } },
    scr_lf2b1l: { name: "Documents", route: "/documents", position: { "x": 160, "y": 16060 } },
    scr_i83vx6: { name: "Activité", route: "/activite", position: { "x": 160, "y": 18040 } }
  },
  sections: {
    sec_xwjo8w: { name: "Dashboard", x: 0, y: 0, width: 1520, height: 1180 },
    sec_k490e4: { name: "Opportunities", x: 0, y: 1980, width: 4320, height: 1180 },
    sec_xlqpse: { name: "Applications", x: 0, y: 3960, width: 2920, height: 1180 },
    sec_alsu4w: { name: "CV — Model selection", x: 0, y: 5940, width: 2920, height: 1180 },
    sec_by84vb: { name: "CV — Vocal interview", x: 0, y: 7920, width: 5720, height: 1180 },
    sec_zmmzi9: { name: "CV — Editor", x: 0, y: 9900, width: 2920, height: 1180 },
    sec_dml9dy: { name: "Profile", x: 0, y: 11880, width: 1520, height: 1180 },
    sec_s2mlyv: { name: "Settings", x: 0, y: 13860, width: 4320, height: 1180 },
    sec_7bo058: { name: "Documents", x: 0, y: 15840, width: 1520, height: 1180 },
    sec_8ntt2k: { name: "Activity", x: 0, y: 17820, width: 1520, height: 1180 }
  },
  layers: [
  { kind: "section", id: "sec_xwjo8w", children: [
    { kind: "screen", id: "scr_00y356" }]
  },
  { kind: "section", id: "sec_k490e4", children: [
    { kind: "screen", id: "scr_29w60n" },
    { kind: "screen", id: "scr_ytehel" },
    { kind: "screen", id: "scr_398ajn" }]
  },
  { kind: "section", id: "sec_xlqpse", children: [
    { kind: "screen", id: "scr_qa55iw" },
    { kind: "screen", id: "scr_rfxfd2" }]
  },
  { kind: "section", id: "sec_alsu4w", children: [
    { kind: "screen", id: "scr_sp876p" },
    { kind: "screen", id: "scr_3pl3zq" }]
  },
  { kind: "section", id: "sec_by84vb", children: [
    { kind: "screen", id: "scr_612dys" },
    { kind: "screen", id: "scr_32znqr" },
    { kind: "screen", id: "scr_9ddgkh" },
    { kind: "screen", id: "scr_sukush" }]
  },
  { kind: "section", id: "sec_zmmzi9", children: [
    { kind: "screen", id: "scr_92u9o2" },
    { kind: "screen", id: "scr_ni1dbv" }]
  },
  { kind: "section", id: "sec_dml9dy", children: [
    { kind: "screen", id: "scr_lknz4u" }]
  },
  { kind: "section", id: "sec_s2mlyv", children: [
    { kind: "screen", id: "scr_ydswcb" },
    { kind: "screen", id: "scr_zw0vs1" },
    { kind: "screen", id: "scr_bq4eoi" }]
  },
  { kind: "section", id: "sec_7bo058", children: [
    { kind: "screen", id: "scr_lf2b1l" }]
  },
  { kind: "section", id: "sec_8ntt2k", children: [
    { kind: "screen", id: "scr_i83vx6" }]
  }]

};