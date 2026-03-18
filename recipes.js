const InitialRecipes = [
    { 
        id: 'hoff_v60', name: "James Hoffmann V60", method: "V60", ratio: 16, temp: 94, clicks: 84, total: 180, 
        steps: [
            { time: 0, targetPct: 20, title: "Pré-infusão", tip: "Saturar todo o café lentamente", pourTime: 10 },
            { time: 30, targetPct: 50, title: "1º Despejo", tip: "Despejo circular suave", pourTime: 20 },
            { time: 60, targetPct: 80, title: "2º Despejo", tip: "Manter fluxo contínuo e uniforme", pourTime: 20 },
            { time: 90, targetPct: 100, title: "Finalização", tip: "Finalizar no centro para nivelar", pourTime: 15 }
        ] 
    },
    { 
        id: 'kasuya_46', name: "Tetsu Kasuya 4:6", method: "V60", ratio: 15, temp: 92, clicks: 120, total: 210, 
        steps: [
            { time: 0, targetPct: 20, title: "1º Despejo", tip: "Define a acidez inicial", pourTime: 10 },
            { time: 45, targetPct: 40, title: "2º Despejo", tip: "Ajusta a doçura", pourTime: 10 },
            { time: 90, targetPct: 60, title: "3º Despejo", tip: "Inicia a força", pourTime: 10 },
            { time: 135, targetPct: 80, title: "4º Despejo", tip: "Desenvolve corpo", pourTime: 10 },
            { time: 180, targetPct: 100, title: "Finalização", tip: "Drenagem total e equilíbrio", pourTime: 10 }
        ] 
    },
    { 
        id: 'rao_v60', name: "Scott Rao V60", method: "V60", ratio: 16.5, temp: 96, clicks: 82, total: 180, 
        steps: [
            { time: 0, targetPct: 25, title: "Pré-infusão", tip: "Leve agitação (swirl) para uniformizar", pourTime: 10 },
            { time: 45, targetPct: 100, title: "Despejo Único", tip: "Sem pausas mantendo fluxo constante", pourTime: 60 }
        ] 
    },
    { 
        id: 'hedrick_v60', name: "Lance Hedrick V60", method: "V60", ratio: 15, temp: 95, clicks: 82, total: 180, 
        steps: [
            { time: 0, targetPct: 20, title: "Pré-infusão", tip: "Agite bem (swirl) para saturar", pourTime: 10 },
            { time: 45, targetPct: 100, title: "Despejo", tip: "Fluxo controlado evitando turbulência", pourTime: 40 }
        ] 
    },
    { 
        id: 'simple_v60', name: "Simple V60", method: "V60", ratio: 17, temp: 94, clicks: 90, total: 150, 
        steps: [
            { time: 0, targetPct: 20, title: "Pré-infusão", tip: "Saturar pó rapidamente", pourTime: 10 },
            { time: 30, targetPct: 100, title: "Despejo", tip: "Direto ao ponto", pourTime: 30 }
        ] 
    },
    { id: 'esp_classic', name: "Espresso Clássico", method: "Espresso", ratio: 2, temp: 94, clicks: 40, total: 30, steps: [{ time: 0, targetPct: 100, title: "Extração", tip: "Alvo: 2:1 ratio.", pourTime: 30 }] },
    { id: 'fp_classic', name: "Prensa Clássica", method: "Prensa Francesa", ratio: 15, temp: 93, clicks: 130, total: 240, steps: [{ time: 0, targetPct: 100, title: "Infusão", tip: "Aguarde até 3:30.", pourTime: 10 }] },
    { id: 'hoff_aero', name: "Hoffmann AeroPress", method: "AeroPress", ratio: 16, temp: 95, clicks: 65, total: 120, steps: [{ time: 0, targetPct: 100, title: "Infusão", tip: "Coloque toda a água e tampe", pourTime: 10 }, { time: 120, targetPct: 100, title: "Pressione", tip: "Pressione suavemente", pourTime: 30 }] },
    { id: 'cold_brew', name: "Cold Brew", method: "Imersão", ratio: 4, temp: 20, clicks: 130, total: 300, steps: [{ time: 0, targetPct: 100, title: "Imersão Total", tip: "Deixe na geladeira por 12-18h", pourTime: 20 }] }
];
