const InitialRecipes = [
    { 
        id: 'signature_v60', 
        name: "Ritual Signature", 
        method: "V60", 
        ratio: 17, temp: 94, grinder: "K6", clicks: 85, total: 195, 
        steps: [
            { time: 0, targetPct: 0.18, title: "Bloom (Infusão)", tip: "Sature o pó e libere o CO2.", pourTime: 10 },
            { time: 45, targetPct: 0.58, title: "1º Despejo", tip: "Fluxo rápido e circular.", pourTime: 15 },
            { time: 75, targetPct: 1.00, title: "2º Despejo", tip: "Fluxo lento e central.", pourTime: 15 },
            { time: 105, targetPct: 1.00, title: "Drenagem", tip: "Aguarde a descida total.", pourTime: 0 },
            { time: 195, targetPct: 1.00, title: "Finalizado", tip: "Aproveite seu ritual.", pourTime: 0 }
        ] 
    },
    { 
        id: 'kasuya_46', 
        name: "Tetsu Kasuya (4:6)", 
        method: "V60", 
        ratio: 15, temp: 92, grinder: "K6", clicks: 120, total: 210, 
        steps: [
            { time: 0, targetPct: 0.20, title: "1º Despejo", tip: "Acidez: Moagem grossa.", pourTime: 10 },
            { time: 45, targetPct: 0.40, title: "2º Despejo", tip: "Doçura: Aguarde drenar.", pourTime: 10 },
            { time: 90, targetPct: 0.60, title: "3º Despejo", tip: "Corpo: Início 60%.", pourTime: 10 },
            { time: 135, targetPct: 0.80, title: "4º Despejo", tip: "Mantenha o ritmo.", pourTime: 10 },
            { time: 180, targetPct: 1.00, title: "5º Despejo Final", tip: "Drenagem total.", pourTime: 10 }
        ] 
    },
    { 
        id: 'rao_v60', 
        name: "Scott Rao Method", 
        method: "V60", 
        ratio: 16.3, temp: 97, grinder: "K6", clicks: 80, total: 180, 
        steps: [
            { time: 0, targetPct: 0.15, title: "Bloom", tip: "Gire o dripper após despejar.", pourTime: 8 },
            { time: 45, targetPct: 1.00, title: "Despejo Único", tip: "Fluxo suave até o final.", pourTime: 40 },
            { time: 120, targetPct: 1.00, title: "Finalização", tip: "Giro final para cama plana.", pourTime: 0 }
        ] 
    },
    { 
        id: 'hedrick_v60', 
        name: "Lance Hedrick", 
        method: "V60", 
        ratio: 15, temp: 95, grinder: "K6", clicks: 82, total: 180, 
        steps: [
            { time: 0, targetPct: 0.20, title: "Bloom Agressivo", tip: "Agite bem o pó úmido.", pourTime: 10 },
            { time: 45, targetPct: 0.60, title: "1º Despejo", tip: "Círculos rápidos.", pourTime: 15 },
            { time: 100, targetPct: 1.00, title: "2º Despejo", tip: "Complete suavemente.", pourTime: 15 }
        ] 
    }
];