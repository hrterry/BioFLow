// ---- EDIT THESE LISTS ----
const SAMPLES = [
    "MEND154","MEND156","MEND157","MEND158","MEND159","MEND160",
    "MEND161","MEND162"
  ];
  
  const MARKERS = [
    "PLA2G2A","SPON2","TFF3"   // 你要的三个 marker gene
  ];
  
  const METHODS = ["BioFlow","GT","STFlow","STEM","MERGE","TRIPLEX"];
  
  // Negative-visualization placeholder count
  const NEG_PLACEHOLDER = 12; // 先给12个坑位，你可改
  
  const FIG_DIR = "assets/figs/";
  
  // ---- helpers ----
  const byId = (x)=>document.getElementById(x);
  
  function populateSelect(sel, items){
    sel.innerHTML = items.map(v=>`<option value="${v}">${v}</option>`).join("");
  }
  
  // 将显示名称映射到文件名格式
  function methodToFileName(method){
    if (method === "GT") {
      return "ground_truth";
    }
    return method;
  }
  
  function fileName(sample, gene, method){
    const fileMethod = methodToFileName(method);
    return `${sample}_${gene}_${fileMethod}.png`;
  }
  
  function buildMarkerGrid(sample, gene){
    const grid = byId("marker-grid");
    grid.innerHTML = "";
    METHODS.forEach(method=>{
      const fn = fileName(sample, gene, method);
      const card = document.createElement("div");
      card.className = "marker-card";
      card.innerHTML = `
        <img src="${FIG_DIR}${fn}" alt="${fn}"
             onerror="this.src='${FIG_DIR}placeholder.png'"/>
        <div class="title">${method}</div>
      `;
      grid.appendChild(card);
    });
  }
  
  function buildNegGallery(){
    const gal = byId("neg-gallery");
    gal.innerHTML = "";
    for(let i=0;i<NEG_PLACEHOLDER;i++){
      const item = document.createElement("div");
      item.className = "gallery-item";
      item.innerHTML = `
        <img src="${FIG_DIR}neg_placeholder_${i+1}.png"
             alt="neg placeholder ${i+1}"
             onerror="this.src='${FIG_DIR}placeholder.png'"/>
        <div class="label">Negative viz placeholder #${i+1}</div>
      `;
      gal.appendChild(item);
    }
  }
  
  function init(){
    const sampleSel = byId("sample-select");
    const geneSel = byId("gene-select");
    populateSelect(sampleSel, SAMPLES);
    populateSelect(geneSel, MARKERS);
  
    buildMarkerGrid(SAMPLES[0], MARKERS[0]);
    buildNegGallery();
  
    sampleSel.addEventListener("change", ()=>buildMarkerGrid(sampleSel.value, geneSel.value));
    geneSel.addEventListener("change", ()=>buildMarkerGrid(sampleSel.value, geneSel.value));
  }
  
  document.addEventListener("DOMContentLoaded", init);
  