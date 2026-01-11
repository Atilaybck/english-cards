// DOM
const container = document.getElementById("cards");
const progressDiv = document.getElementById("progress");
const resetBtn = document.getElementById("reset");
const unlearnBtn = document.getElementById("unlearnedBtn");
const pageButtonsContainer = document.getElementById("pageButtons");
const searchBtn = document.getElementById("searchBtn");
const searchInput = document.getElementById("searchInput");
const searchResult = document.getElementById("searchResult");
const liveResults = document.getElementById("liveResults");

let currentPage = 1;
let showUnlearned = false;
const pageButtons = [];
let existingPages = [];

// localStorage helpers
const getLS = (key) => JSON.parse(localStorage.getItem(key) || "[]");
const setLS = (key, val) => localStorage.setItem(key, JSON.stringify(val));

// Karıştırma
const shuffle = (arr) => {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
};

// Sayfa verisi çekme
function fetchPages(pages) {
  return Promise.all(
    pages.map((p) =>
      fetch(`data/page${p}.json`).then((r) =>
        r.json().then((d) => d.map((it) => ({ ...it, page: p })))
      )
    )
  ).then((arr) => arr.flat());
}

// Kart verileri
let deck = [];
let index = 0;

function updateProgress() {
  progressDiv.textContent = deck.length === 0 ? "" : `${index + 1}/${deck.length}`;
}

function showNextCard() {
  container.innerHTML = "";

  if (index >= deck.length) {
    progressDiv.textContent = `${deck.length}/${deck.length}`;
    container.textContent = "✅ Bu sayfadaki tüm kartları tamamladın";
    updateStrike();
    return;
  }

  const { tr, en, page } = deck[index];
  const key = `${page}_${en}`;

  const card = document.createElement("div");
  const inner = document.createElement("div");
  const front = document.createElement("div");
  const back = document.createElement("div");
  const tick = document.createElement("button");
  const xBtn = document.createElement("button");

  card.className = "card";
  inner.className = "inner";
  front.className = "side front";
  back.className = "side back";
  tick.className = "tick";
  xBtn.className = "unlearn";

  front.textContent = tr;
  back.textContent = en;
  tick.textContent = "✔";
  xBtn.textContent = "✘";

  tick.onclick = (e) => {
    e.stopPropagation();
    handleResult("hiddenWords");
  };

  xBtn.onclick = (e) => {
    e.stopPropagation();
    handleResult("unlearnedWords");
  };

  card.onclick = () => card.classList.toggle("flipped");

  function handleResult(listName) {
    const arr = getLS(listName);
    if (!arr.includes(key)) {
      arr.push(key);
      setLS(listName, arr);
    }

    if (listName === "hiddenWords") {
      const un = getLS("unlearnedWords");
      const idx = un.indexOf(key);
      if (idx !== -1) {
        un.splice(idx, 1);
        setLS("unlearnedWords", un);
      }
    }

    index++;
    updateProgress();
    showNextCard();
  }

  inner.append(front, back);
  card.append(xBtn, tick, inner);
  container.append(card);
  updateProgress();
}

function updateStrike() {
  if (showUnlearned) return;

  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  pageButtons.forEach(({ page, btn }) => {
    btn.style.textDecoration = "none";
    btn.classList.remove("completed");

    fetchPages([page]).then((words) => {
      const visible = words.filter((w) => {
        const key = `${w.page}_${w.en}`;
        return !hidden.includes(key) && !unlearn.includes(key);
      });

      if (visible.length === 0) {
        btn.style.textDecoration = "line-through";
        btn.classList.add("completed");
      }
    });
  });
}

function renderWords() {
  const hidden = getLS("hiddenWords");
  const unlearn = getLS("unlearnedWords");

  const pagesToFetch = showUnlearned ? pageButtons.map((p) => p.page) : [currentPage];

  fetchPages(pagesToFetch).then((words) => {
    deck = words.filter(({ en, page }) => {
      const key = `${page}_${en}`;
      if (showUnlearned) return unlearn.includes(key);
      return !hidden.includes(key) && !unlearn.includes(key);
    });

    shuffle(deck);
    index = 0;
    showNextCard();

    pageButtons.forEach(({ btn, page }) =>
      btn.classList.toggle("active", !showUnlearned && page === currentPage)
    );

    unlearnBtn.classList.toggle("active", showUnlearned);

    // ✅ Reset sonrası “tamamlandı” tik/çizgileri doğru güncellensin
    updateStrike();
  });
}

resetBtn.onclick = () => {
  localStorage.removeItem("hiddenWords");
  localStorage.removeItem("unlearnedWords");

  // ✅ Reset'e basınca sayfa butonlarındaki çizgi/tik görünümü hemen silinsin
  pageButtons.forEach(({ btn }) => {
    btn.style.textDecoration = "none";
    btn.classList.remove("completed");
  });

  showUnlearned = false;
  renderWords();
};

unlearnBtn.onclick = () => {
  showUnlearned = true;
  renderWords();
};

// ✅ Dinamik olarak sadece var olan pageX.json dosyaları için buton oluştur
(async () => {
  const maxCheckPages = 50; // En fazla 50 sayfa kontrol edilecek

  for (let i = 1; i <= maxCheckPages; i++) {
    try {
      const res = await fetch(`data/page${i}.json`);
      if (!res.ok) break;

      await res.json(); // geçerli mi kontrol
      existingPages.push(i);

      const btn = document.createElement("button");
      btn.textContent = `${i}`;
      btn.className = "pageBtn";

      btn.onclick = () => {
        currentPage = i;
        showUnlearned = false;
        renderWords();
      };

      pageButtons.push({ page: i, btn });
      pageButtonsContainer.appendChild(btn);
    } catch (err) {
      break;
    }
  }

  renderWords();
})();

// 🔍 Arama (butonla)
// 🔍 Arama (butonla)
searchBtn.onclick = async () => {
  const query = searchInput.value.trim().toLowerCase();
  if (!query) return;

  searchResult.textContent = "Aranıyor...";
  let foundSentences = [];

  for (const page of existingPages) {
    try {
      const res = await fetch(`data/page${page}.json`);
      const data = await res.json();

      data.forEach((item) => {
        if (
          item.tr.toLowerCase().includes(query) ||
          item.en.toLowerCase().includes(query)
        ) {
          foundSentences.push({ ...item, page });
        }
      });
    } catch (err) {
      console.error(`page${page}.json yüklenemedi`, err);
    }
  }

  if (foundSentences.length > 0) {
    const list = document.createElement("ul");
    list.style.listStyle = "none";
    list.style.padding = "0";

    foundSentences.forEach((item) => {
      const li = document.createElement("li");
      li.style.background = "#fff";
      li.style.margin = "5px 0";
      li.style.padding = "10px";
      li.style.borderRadius = "8px";
      li.style.boxShadow = "0 1px 3px rgba(0,0,0,0.1)";
      li.innerHTML = `<strong>Sayfa ${item.page}:</strong> ${item.tr} <br> <small style="color:#666">${item.en}</small>`;

      // Tıklayınca karta git
      li.style.cursor = "pointer";
      li.onclick = () => {
        deck = [item];
        index = 0;
        currentPage = item.page; // Sayfayı güncelle

        // Butonları güncelle
        pageButtons.forEach(({ btn, page }) =>
          btn.classList.toggle("active", page === currentPage)
        );

        showNextCard();
        container.scrollIntoView({ behavior: "smooth" });
      };

      list.appendChild(li);
    });

    searchResult.innerHTML = "";
    searchResult.appendChild(list);
  } else {
    searchResult.innerHTML = `<strong>❌ Bulunamadı</strong>`;
  }
};

// 🔍 Canlı arama (yazdıkça)
searchInput.oninput = async () => {
  const input = searchInput.value.trim().toLowerCase();
  if (!liveResults) return;

  liveResults.innerHTML = "";
  if (!input) return;

  for (const page of existingPages) {
    try {
      const res = await fetch(`data/page${page}.json`);
      const data = await res.json();

      data.forEach((item) => {
        const tr = item.tr.toLowerCase();
        const en = item.en.toLowerCase();

        if (tr.includes(input) || en.includes(input)) {
          const li = document.createElement("li");
          li.textContent = `Sayfa ${page}: ${item.tr} – ${item.en}`;

          li.style.cursor = "pointer";
          li.onclick = () => {
            deck = [{ ...item, page }];
            index = 0;
            currentPage = page; // Sayfayı güncelle

            // Butonları güncelle
            pageButtons.forEach(({ btn, page: p }) =>
              btn.classList.toggle("active", p === currentPage)
            );

            showNextCard();
            container.scrollIntoView({ behavior: "smooth" });
            liveResults.innerHTML = ""; // Seçince listeyi temizle
            searchInput.value = ""; // Inputu temizle
          };

          liveResults.appendChild(li);
        }
      });
    } catch (err) {
      console.error(`page${page}.json yüklenemedi`, err);
    }
  }

  if (liveResults.childElementCount === 0) {
    const li = document.createElement("li");
    li.textContent = "❌ Eşleşme bulunamadı.";
    liveResults.appendChild(li);
  }
};
