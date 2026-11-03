const photoInput = document.getElementById("photoInput");
const photoPanel = document.getElementById("photoPanel");
const photoStatus = document.getElementById("photoStatus");
const photoMatches = document.getElementById("photoMatches");
const photoActions = document.getElementById("photoActions");

document.getElementById("cameraButton").onclick = () => photoInput.click();
document.getElementById("photoBack").onclick = () => {
  photoPanel.hidden = true;
  photoInput.value = "";
};

photoInput.onchange = async () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  photoPanel.hidden = false;
  photoActions.hidden = true;
  photoMatches.replaceChildren();
  photoStatus.textContent = "Comparing your photo with the archive…";
  const preview = document.getElementById("photoPreview");
  const objectUrl = URL.createObjectURL(file);
  preview.src = objectUrl;
  try {
    await preview.decode();
    if (!items.length) throw new Error("Archive items are still loading. Please try again.");
    const response = await fetch("photo-index.json");
    if (!response.ok) throw new Error("Photo search is unavailable. Please search by name.");
    const index = await response.json();
    let exactHash = "";
    if (crypto.subtle) {
      const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
      exactHash = [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2,"0")).join("");
    }
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 24;
    const ctx = canvas.getContext("2d", {willReadFrequently:true});
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 24, 24);
    ctx.drawImage(preview, 0, 0, 24, 24);
    const pixels = ctx.getImageData(0, 0, 24, 24).data;
    const query = [];
    for (let i = 0; i < pixels.length; i += 4) {
      query.push(pixels[i] >> 4, pixels[i+1] >> 4, pixels[i+2] >> 4);
    }
    const catalog = new Map(items.map(item => [item.image.split("|")[0].trim(), item]));
    const ranked = index.map(entry => {
      let distance = 0;
      for (let i = 0; i < 1728; i++) distance += Math.abs(query[i] - parseInt(entry.v[i], 16));
      return {item:catalog.get(entry.file), distance:entry.hash === exactHash && exactHash ? -1 : distance/1728};
    }).filter(result => result.item).sort((a,b) => a.distance - b.distance);
    if (!ranked.length || ranked[0].distance > 2.5) {
      photoStatus.textContent = "No close visual match found. You can request this item or go back.";
    } else {
      photoStatus.textContent = "Possible matches — select the exact item, then choose its size.";
      ranked.slice(0, 6).forEach(({item}) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "photo-match";
        const img = document.createElement("img");
        img.src = item.image.split("|")[0].trim();
        img.alt = "";
        const label = document.createElement("span");
        label.textContent = item.name;
        button.append(img, label);
        button.onclick = () => {
          selectedItem = item;
          document.getElementById("search").value = item.name;
          setSizeOptions(item);
          photoPanel.hidden = true;
          document.getElementById("result").replaceChildren();
          document.getElementById("size").focus();
        };
        photoMatches.appendChild(button);
      });
    }
    photoActions.hidden = false;
  } catch (error) {
    photoStatus.textContent = error.message || "Could not check this photo. Please search by name.";
    photoActions.hidden = false;
  } finally {
    URL.revokeObjectURL(objectUrl);
    photoInput.value = "";
  }
};
