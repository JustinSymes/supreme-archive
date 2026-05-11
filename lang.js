const translations = {
  English: {
    add: "+ Add",
    buildFit: "Build a Fit",
    requestItems: "Request Items",
    languageCurrency: "Language & Currency",
    socials: "Socials",
    settingsTitle: "Change your settings",
    settingsSub: "Choose your language & preferred currency below",
    language: "Language",
    currency: "Currency",
    cancel: "Cancel",
    saveChanges: "Save Changes",
    totalPieces: "Total Pieces",

    all: "All",
    tops: "Tops",
    bottoms: "Bottoms",
    hats: "Hats",
    bags: "Bags",
    accessories: "Accessories",
    skate: "Skate",

    back: "← Back",
    backArchive: "← Back to Archive",
    addItem: "Add Item",
    searchItem: "Search item name...",
    selectSize: "Select size",
    addItemBtn: "Add Item",

    category: "Category",
    retail: "Retail",
    size: "Size",

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
    add: "+ Ajouter",
    buildFit: "Créer un Fit",
    requestItems: "Demander des items",
    languageCurrency: "Langue et devise",
    socials: "Réseaux sociaux",
    settingsTitle: "Modifier vos réglages",
    settingsSub: "Choisissez votre langue et votre devise préférée",
    language: "Langue",
    currency: "Devise",
    cancel: "Annuler",
    saveChanges: "Enregistrer",
    totalPieces: "Pièces totales",

    all: "Tout",
    tops: "Hauts",
    bottoms: "Bas",
    hats: "Chapeaux",
    bags: "Sacs",
    accessories: "Accessoires",
    skate: "Skate",

    back: "← Retour",
    backArchive: "← Retour à l’archive",
    addItem: "Ajouter un item",
    searchItem: "Rechercher un item...",
    selectSize: "Choisir une taille",
    addItemBtn: "Ajouter",

    category: "Catégorie",
    retail: "Prix retail",
    size: "Taille",

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
    add: "+ Agregar",
    buildFit: "Crear outfit",
    requestItems: "Solicitar artículos",
    languageCurrency: "Idioma y moneda",
    socials: "Redes sociales",
    settingsTitle: "Cambiar ajustes",
    settingsSub: "Elige tu idioma y moneda preferida",
    language: "Idioma",
    currency: "Moneda",
    cancel: "Cancelar",
    saveChanges: "Guardar",
    totalPieces: "Piezas totales",

    all: "Todo",
    tops: "Tops",
    bottoms: "Pantalones",
    hats: "Gorras",
    bags: "Bolsos",
    accessories: "Accesorios",
    skate: "Skate",

    back: "← Volver",
    backArchive: "← Volver al archivo",
    addItem: "Agregar artículo",
    searchItem: "Buscar artículo...",
    selectSize: "Seleccionar talla",
    addItemBtn: "Agregar",

    category: "Categoría",
    retail: "Precio retail",
    size: "Talla",

    random: "Aleatorio",
    fits: "Fits",
    save: "Guardar",

    requestItem: "Solicitar artículo",
    yourEmail: "Tu email (opcional)",
    itemName: "Nombre del artículo",
    season: "Temporada",
    submit: "Enviar"
  },

  Japanese: {
    add: "+ 追加",
    buildFit: "コーデ作成",
    requestItems: "アイテムをリクエスト",
    languageCurrency: "言語と通貨",
    socials: "SNS",
    settingsTitle: "設定を変更",
    settingsSub: "言語と通貨を選択してください",
    language: "言語",
    currency: "通貨",
    cancel: "キャンセル",
    saveChanges: "保存",
    totalPieces: "合計アイテム",

    all: "すべて",
    tops: "トップス",
    bottoms: "ボトムス",
    hats: "帽子",
    bags: "バッグ",
    accessories: "アクセサリー",
    skate: "スケート",

    back: "← 戻る",
    backArchive: "← アーカイブへ戻る",
    addItem: "アイテム追加",
    searchItem: "アイテム名を検索...",
    selectSize: "サイズを選択",
    addItemBtn: "追加",

    category: "カテゴリー",
    retail: "定価",
    size: "サイズ",

    random: "ランダム",
    fits: "Fits",
    save: "保存",

    requestItem: "アイテムをリクエスト",
    yourEmail: "メール（任意）",
    itemName: "アイテム名",
    season: "シーズン",
    submit: "送信"
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
