// src/js/modules/co/circuit-manager.js
// Ce module gère la création et la suppression des circuits de Course d'Orientation (stockage local)

export function getCircuits() {
    const c = localStorage.getItem('eps_arena_circuits');
    return c ? JSON.parse(c) : [];
}

export function addCircuit(cat, nom, balises) {
    const circuits = getCircuits();
    circuits.push({ id: Date.now(), cat: cat.trim(), nom: nom.trim(), balises: balises.split(',').map(x => x.trim()) });
    localStorage.setItem('eps_arena_circuits', JSON.stringify(circuits));
    return circuits;
}

export function editCircuit(id, nouvelleListe) {
    let circuits = getCircuits();
    const circ = circuits.find(c => c.id === id);
    if(circ) {
        circ.balises = nouvelleListe.split(',').map(x => x.trim());
        localStorage.setItem('eps_arena_circuits', JSON.stringify(circuits));
    }
    return circuits;
}

export function delCircuit(id) {
    let circuits = getCircuits();
    circuits = circuits.filter(c => c.id !== id);
    localStorage.setItem('eps_arena_circuits', JSON.stringify(circuits));
    return circuits;
}

export function delCat(catName) {
    let circuits = getCircuits();
    circuits = circuits.filter(c => c.cat !== catName);
    localStorage.setItem('eps_arena_circuits', JSON.stringify(circuits));
    return circuits;
}

export function renderCircuits(containerId, activeCat) {
    const circuits = getCircuits();
    const list = document.getElementById(containerId);
    if(!list) return;
    
    const lieux = {};
    circuits.forEach(c => { if(!lieux[c.cat]) lieux[c.cat] = []; lieux[c.cat].push(c); });
    
    let html = `<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">`;
    for(let lieu in lieux) {
        const isActive = (lieu === activeCat);
        html += `<div class="bg-slate-900 p-6 rounded-[2rem] border-2 ${isActive ? 'border-emerald-500' : 'border-slate-700'}">
            <div class="flex justify-between items-center mb-4"><h3 class="text-2xl font-black text-blue-400 italic">${lieu}</h3>
            <button onclick="activateCategory('${lieu}')" class="bg-blue-600 px-3 py-1.5 text-[10px] font-black rounded-xl">${isActive ? '🎯 ACTIF' : '🎯 ACTIVER'}</button></div>
            <div class="space-y-4">${lieux[lieu].map(c => `
                <div class="bg-black p-4 rounded-2xl border border-slate-700">
                    <div class="flex justify-between mb-3"><span class="font-black text-lg underline">Circuit ${c.nom}</span>
                    <button onclick="editCircuit(${c.id})" class="text-[10px] font-black uppercase bg-slate-700 px-3 py-1 rounded-lg">MODIF</button></div>
                    <div class="flex flex-wrap gap-2">${c.balises.map(b => `<span class="bg-slate-800 text-2xl font-black px-4 py-2 rounded-xl border border-slate-600">${b}</span>`).join('')}</div>
                </div>`).join('')}</div></div>`;
    }
    list.innerHTML = html + `</div>`;
}