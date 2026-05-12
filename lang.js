const translations = {
  English: {
    back: "← Back",
    backArchive: "← Back to Archive",
    addItem: "Add Item",
    searchItem: "Search item name...",
    selectSize: "Select size",
    addItemBtn: "Add Item",
    category: "Category",
    retail: "Retail",
    size: "Size",
    buildFit: "Build a Fit",
    random: "Random",
    fits: "Fits",
    save: "Save",
    requestItem: "Request Item",
    yourEmail: "Your email (optional)",
    itemName: "Item name",
    season: "Season",
    submit: "Submit"
  },
  French: {
    back: "← Retour",
    backArchive: "← Retour à l’archive",
    addItem: "Ajouter un item",
    searchItem: "Rechercher un item...",
    selectSize: "Choisir une taille",
    addItemBtn: "Ajouter",
    category: "Catégorie",
    retail: "Prix retail",
    size: "Taille",
    buildFit: "Créer un Fit",
    random: "Aléatoire",
    fits: "Fits",
    save: "Sauver",
    requestItem: "Demander un item",
    yourEmail: "Votre email (optionnel)",
    itemName: "Nom de l’item",
    season: "Saison",
    submit: "Envoyer"
  },
  Spanish: {
    back: "← Volver",
    backArchive: "← Volver al archivo",
    addItem: "Agregar artículo",
    searchItem: "Buscar artículo...",
    selectSize: "Seleccionar talla",
    addItemBtn: "Agregar",
    category: "Categoría",
    retail: "Precio retail",
    size: "Talla",
    buildFit: "Crear outfit",
    random: "Aleatorio",
    fits: "Fits",
    save: "Guardar",
    requestItem: "Solicitar artículo",
    yourEmail: "Tu email (opcional)",
    itemName: "Nombre del artículo",
    season: "Temporada",
    submit: "Enviar"
  }
};

function getLang(){
  return localStorage.getItem("language") || "English";
}

function t(key){
  return translations[getLang()]?.[key] || translations.English[key] || key;
}

function setText(id, key){
  const el = document.getElementById(id);
  if(el) el.textContent = t(key);
}

function setPlaceholder(id, key){
  const el = document.getElementById(id);
  if(el) el.placeholder = t(key);
}
