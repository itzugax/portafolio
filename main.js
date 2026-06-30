/* ==========================================================================
   GEOMETRY VAULT - CORE INTERACTION, SUPABASE & AUDIO LOGIC
   ========================================================================== */

// 1. SUPABASE CREDENTIALS CONFIGURATION
// Rellena estas constantes con los datos de tu proyecto Supabase.
// Si las dejas tal como están, el portafolio cargará automáticamente la base de datos estática local (modo offline/demo).
const SUPABASE_URL = "https://fqvkyiojmaahkltjemtm.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZxdmt5aW9qbWFhaGtsdGplbXRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzg1MDcwNTEsImV4cCI6MjA5NDA4MzA1MX0.zOlq-a9yz_nnZ0aDKWCKJ4ZwVoVZW6Q_8OmJZ8F6H4k";

let supabaseClient = null;
let isSupabaseConfigured = false;

if (SUPABASE_URL !== "YOUR_SUPABASE_URL" && SUPABASE_ANON_KEY !== "YOUR_SUPABASE_ANON_KEY") {
    try {
        supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        isSupabaseConfigured = true;
        console.log("Supabase inicializado correctamente.");
    } catch (e) {
        console.error("Error al inicializar Supabase: ", e);
    }
} else {
    console.warn("Supabase no configurado. Iniciando en modo Offline/Demo con datos estáticos locales.");
}

// 2. DATA CONFIGURATION: Static Fallback Array (Modo offline)
const STATIC_THUMBNAILS = [];

let activeThumbnails = [...STATIC_THUMBNAILS];

// 3. AUDIO SYNTHESIZER FOR SFX ONLY (NO BACKGROUND MUSIC)
const AudioSystem = {
    ctx: null,
    muted: false, // Activo por defecto para SFX interactivos

    init() {
        if (this.ctx) return;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AudioContext();
    },

    playTone(freqStart, freqEnd, duration, type = 'sine', volume = 0.05) {
        if (this.muted || !this.ctx) return;
        try {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();
            
            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);
            
            osc.type = type;
            osc.frequency.setValueAtTime(freqStart, this.ctx.currentTime);
            
            if (freqEnd && freqEnd !== freqStart) {
                osc.frequency.exponentialRampToValueAtTime(freqEnd, this.ctx.currentTime + duration);
            }
            
            gainNode.gain.setValueAtTime(volume, this.ctx.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + duration);
            
            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn(e);
        }
    },

    hover() {
        this.playTone(900, 1000, 0.05, 'sine', 0.015);
    },

    click() {
        this.playTone(1200, 600, 0.08, 'triangle', 0.04);
    },

    open() {
        this.playTone(300, 800, 0.2, 'sine', 0.03);
    },

    close() {
        this.playTone(700, 200, 0.15, 'sine', 0.03);
    }
};

// Activar el contexto de audio en la primera interacción del usuario para cumplir con las políticas del navegador
document.addEventListener("click", () => {
    AudioSystem.init();
    if (AudioSystem.ctx && AudioSystem.ctx.state === "suspended") {
        AudioSystem.ctx.resume();
    }
}, { once: true });

// 4. MAIN INITIALIZER
document.addEventListener("DOMContentLoaded", async () => {
    // Load initial data
    await loadThumbnailsData();
    
    // Setup views
    initPreloader();
    setupCursor();
    setupLightbox();
    setupAdminCMS();

    setupContactModal();
    setupSearch();

    // SECRET ADMIN ACCESS: Abre el panel si la URL contiene #admin
    // Uso: navega a tu-web.com/#admin para entrar al CMS
    if (window.location.hash === "#admin") {
        // Limpia el hash de la URL para que no quede visible
        history.replaceState(null, "", window.location.pathname);
        // Pequeño delay para que el panel esté listo
        setTimeout(() => {
            const trigger = document.getElementById("admin-trigger");
            if (trigger) trigger.click();
        }, 800);
    }
});

// 5. DATABASE LOADER (Supabase or Offline fallback)
async function loadThumbnailsData() {
    if (isSupabaseConfigured) {
        try {
            const { data, error } = await supabaseClient
                .from('thumbnails')
                .select('*')
                .order('id', { ascending: true });
                
            if (error) throw error;
            
            if (data && data.length > 0) {
                activeThumbnails = data;
            } else {
                console.log("Tabla de Supabase vacía.");
                activeThumbnails = [];
            }
        } catch (e) {
            console.error("Error al conectar con la base de datos de Supabase: ", e);
            activeThumbnails = [];
        }
    }
}

// 6. PRELOADER & AUTO MUSIC INITIATION
function initPreloader() {
    const preloader = document.getElementById("preloader");
    const progressFill = document.querySelector(".loader-progress-fill");
    const counter = document.querySelector(".loader-counter");
    const app = document.getElementById("app");
    
    gsap.set(".loader-title", { y: "100%" });
    gsap.set(".loader-subtitle", { y: "100%", opacity: 0 });
    
    const tl = gsap.timeline();
    tl.to(".loader-title", { y: "0%", duration: 0.8, ease: "power4.out" })
      .to(".loader-subtitle", { y: "0%", opacity: 0.7, duration: 0.6, ease: "power3.out" }, "-=0.4");

    let count = 0;
    const progressInterval = setInterval(() => {
        count += Math.floor(Math.random() * 8) + 4;
        if (count >= 100) {
            count = 100;
            clearInterval(progressInterval);
            
            // Finish loader bar
            gsap.to(progressFill, { width: "100%", duration: 0.3, onComplete: () => {
                revealPortfolio();
            }});
        }
        
        counter.textContent = `${count.toString().padStart(2, '0')}%`;
        progressFill.style.width = `${count}%`;
    }, 40);

    function revealPortfolio() {
        // Render main grid with up-to-date data
        renderGrid();
        
        // Unlock audio context
        AudioSystem.init();
        
        // Exit screen animation
        gsap.timeline()
            .to(preloader, { 
                yPercent: -100, 
                duration: 1.2, 
                ease: "power4.inOut" 
            })
            .call(() => {
                app.classList.remove("hidden");
                document.body.style.overflowY = "auto"; // Unlock scroll
            }, null, "-=0.6")
            .from(".main-header", { 
                y: -50, 
                opacity: 0, 
                duration: 1, 
                ease: "power3.out" 
            }, "-=0.4")
            .from(".hero-title", {
                opacity: 0,
                y: 40,
                duration: 1,
                ease: "power4.out"
            }, "-=0.6")
            .from(".card-container", {
                opacity: 0,
                y: 60,
                stagger: 0.12,
                duration: 1.2,
                ease: "power4.out"
            }, "-=0.6");
    }
}

// 7. INSTANT CUSTOM CURSOR (NO LAG)
function setupCursor() {
    const cursor = document.querySelector(".custom-cursor");
    
    document.body.style.cursor = "none";
    
    window.addEventListener("mousemove", (e) => {
        // Posicionar el cursor instantáneamente sin lag/delay
        gsap.set(cursor, { x: e.clientX, y: e.clientY });
        
        // Desplazamiento de paralaje suave para el fondo (máx 35px en dirección opuesta)
        const xPercent = (e.clientX / window.innerWidth) - 0.5;
        const yPercent = (e.clientY / window.innerHeight) - 0.5;
        
        gsap.to(".bg-image", {
            x: -xPercent * 35,
            y: -yPercent * 35,
            duration: 1.2,
            ease: "power2.out",
            overwrite: "auto"
        });
    });
    
    document.addEventListener("mouseover", (e) => {
        const target = e.target;
        if (target.closest(".magnet-target") || target.tagName === "A" || target.tagName === "BUTTON") {
            cursor.classList.add("active");
            AudioSystem.hover();
        }
        if (target.closest(".card-container")) {
            cursor.classList.add("hover-thumbnail");
            AudioSystem.hover();
        }
    });

    document.addEventListener("mouseout", (e) => {
        const target = e.target;
        if (target.closest(".magnet-target") || target.tagName === "A" || target.tagName === "BUTTON") {
            cursor.classList.remove("active");
        }
        if (target.closest(".card-container")) {
            cursor.classList.remove("hover-thumbnail");
        }
    });
}

// 8. RENDER DYNAMIC CARD GRID WITH FILTER
function renderGrid() {
    const grid = document.getElementById("thumbnail-grid");
    grid.innerHTML = "";
    
    const searchInput = document.getElementById("gallery-search");
    const query = searchInput ? searchInput.value.toLowerCase().trim() : "";
    
    // Filtrar por título (nivel) o cliente (creador)
    const filtered = activeThumbnails.filter(item => {
        const titleMatch = item.title && item.title.toLowerCase().includes(query);
        const clientMatch = item.client && item.client.toLowerCase().includes(query);
        return titleMatch || clientMatch;
    });

    if (filtered.length === 0) {
        grid.innerHTML = `<div class="no-results" style="grid-column: 1 / -1; text-align: center; padding: 80px 20px; font-family: var(--font-sans); color: var(--color-text-muted); letter-spacing: 2px; font-size: 14px; text-shadow: 0 0 10px rgba(255,255,255,0.05);">NO SE ENCONTRARON MINIATURAS</div>`;
        return;
    }
    
    filtered.forEach((item) => {
        const card = document.createElement("div");
        card.className = "card-container";
        card.setAttribute("data-id", item.id);
        
        const primaryColor = item.primary_color || "#ff3333";
        const secondaryColor = item.secondary_color || "#ff5e00";
        const glowGradient = `linear-gradient(135deg, ${primaryColor}dd, ${secondaryColor}aa)`;
        
        card.innerHTML = `
            <div class="card-inner">
                <div class="card-glow"></div>
                <div class="card-image-wrap">
                    <img class="card-image" src="${item.image_url}" alt="${item.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                    <div class="image-placeholder" style="background: ${glowGradient}; display:none; width:100%; height:100%; align-items:center; justify-content:center; flex-direction:column; gap: 10px;">
                        <span class="placeholder-icon" style="font-size: 32px; filter: drop-shadow(0 0 10px #fff);">👾</span>
                        <span class="placeholder-text" style="font-family: 'Space Grotesk'; font-size: 10px; letter-spacing: 4px; opacity:0.6; color:#fff;">THUMBNAIL PENDING</span>
                    </div>
                </div>
                <div class="card-details">
                    <div class="card-title-meta">
                        <span class="card-difficulty" style="color: ${primaryColor}; text-shadow: 0 0 10px ${primaryColor}66">${item.difficulty}</span>
                        <h3 class="card-title">${item.title}</h3>
                    </div>
                    <span class="card-cta">VER DISEÑO</span>
                </div>
            </div>
        `;
        
        grid.appendChild(card);
        setupCardTilt(card);
    });
}

// 9. CARD 3D TILT EFFECT
function setupCardTilt(card) {
    const inner = card.querySelector(".card-inner");
    const imageWrap = card.querySelector(".card-image-wrap");
    
    card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = (e.clientX - rect.left) / rect.width - 0.5;
        const y = (e.clientY - rect.top) / rect.height - 0.5;
        
        const tiltX = -y * 22;
        const tiltY = x * 22;
        
        const px = -x * 12;
        const py = -y * 12;
        
        const glowX = ((e.clientX - rect.left) / rect.width) * 100;
        const glowY = ((e.clientY - rect.top) / rect.height) * 100;
        inner.style.setProperty("--mx", `${glowX}%`);
        inner.style.setProperty("--my", `${glowY}%`);
        
        gsap.to(inner, {
            rotateX: tiltX,
            rotateY: tiltY,
            transformPerspective: 1500,
            duration: 0.2,
            ease: "power2.out"
        });
        
        gsap.to(imageWrap, {
            x: px,
            y: py,
            scale: 1.12,
            duration: 0.2,
            ease: "power2.out"
        });
    });
    
    card.addEventListener("mouseleave", () => {
        gsap.to(inner, {
            rotateX: 0,
            rotateY: 0,
            duration: 0.6,
            ease: "power3.out"
        });
        
        gsap.to(imageWrap, {
            x: 0,
            y: 0,
            scale: 1.08,
            duration: 0.6,
            ease: "power3.out"
        });
    });
}

// 10. GALLERY SEARCH EVENT LISTENER
function setupSearch() {
    const searchInput = document.getElementById("gallery-search");
    if (!searchInput) return;
    
    searchInput.addEventListener("input", () => {
        renderGrid();
    });
}

// 11. LIGHTBOX INTERACTION (SCREEN FIT CLEAN IMAGE)
function setupLightbox() {
    const lightbox = document.getElementById("lightbox");
    const closeBtn = document.getElementById("close-lightbox");
    const backdrop = document.querySelector(".lightbox-backdrop");
    
    const imgAfter = document.getElementById("img-after");
    const lblDifficulty = document.getElementById("lbl-difficulty");
    const lblTitle = document.getElementById("lbl-title");
    const lblClient = document.getElementById("lbl-client");
    const lblVideoLink = document.getElementById("lbl-video-link");
    
    // Open
    document.addEventListener("click", (e) => {
        const card = e.target.closest(".card-container");
        if (!card) return;
        
        const id = card.getAttribute("data-id");
        const item = activeThumbnails.find(x => x.id == id);
        if (!item) return;
        
        AudioSystem.click();
        AudioSystem.open();
        
        lblTitle.textContent = item.title;
        lblDifficulty.textContent = item.difficulty;
        
        const primaryColor = item.primary_color || "#9d4edd";
        const secondaryColor = item.secondary_color || "#ff3333";
        
        lblDifficulty.style.color = primaryColor;
        lblDifficulty.style.textShadow = `0 0 10px ${primaryColor}66`;

        // Nombre del cliente / para quién es
        lblClient.textContent = item.client || "—";

        // Botón de video: solo visible si hay link
        if (item.video_url && item.video_url.trim() !== "") {
            lblVideoLink.href = item.video_url;
            lblVideoLink.style.display = "inline-flex";
        } else {
            lblVideoLink.style.display = "none";
        }
        
        imgAfter.src = item.image_url;
        imgAfter.onerror = function() {
            this.style.opacity = "0";
            this.parentNode.style.background = `linear-gradient(135deg, ${primaryColor}dd, ${secondaryColor}aa)`;
        };
        imgAfter.style.opacity = "1";
        
        lightbox.classList.add("active");
        document.body.style.overflowY = "hidden";
    });
    
    function closeLightbox() {
        AudioSystem.click();
        AudioSystem.close();
        lightbox.classList.remove("active");
        document.body.style.overflowY = "auto"; // unlock scroll
    }
    
    // Explicit close button hookup
    closeBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeLightbox();
    });
    
    // Backdrop hookup
    backdrop.addEventListener("click", (e) => {
        e.preventDefault();
        closeLightbox();
    });
}

// 12. ADMIN CMS PANEL LOGIC (SUPABASE CRUD & AUTH)
function setupAdminCMS() {
    const adminTrigger = document.getElementById("admin-trigger");
    const adminModal = document.getElementById("admin-modal");
    const closeAdminBtn = document.getElementById("close-admin");
    const adminBackdrop = document.querySelector(".admin-backdrop");
    
    const authSection = document.getElementById("admin-auth-section");
    const dashboardSection = document.getElementById("admin-dashboard-section");
    const loginForm = document.getElementById("admin-login-form");
    const loginError = document.getElementById("login-error-msg");
    const crudForm = document.getElementById("thumbnail-crud-form");
    const crudStatus = document.getElementById("crud-status-msg");
    
    const tableBody = document.getElementById("admin-table-body");
    const cancelEditBtn = document.getElementById("btn-cancel-edit");
    const logoutBtn = document.getElementById("btn-admin-logout");
    
    // Open CMS
    adminTrigger.addEventListener("click", async () => {
        AudioSystem.click();
        AudioSystem.open();
        
        adminModal.classList.add("active");
        document.body.style.overflowY = "hidden";
        
        await checkAdminSession();
    });
    
    // Close CMS
    function closeAdmin() {
        AudioSystem.click();
        AudioSystem.close();
        adminModal.classList.remove("active");
        document.body.style.overflowY = "auto";
        resetCRUDForm();
    }
    
    closeAdminBtn.addEventListener("click", (e) => {
        e.preventDefault();
        closeAdmin();
    });
    
    adminBackdrop.addEventListener("click", (e) => {
        e.preventDefault();
        closeAdmin();
    });

    // CHECK AUTH SESSION
    async function checkAdminSession() {
        if (!isSupabaseConfigured) {
            // Offline demo mode triggers auto-dashboard entry
            showDashboard();
            return;
        }

        try {
            const { data: { session } } = await supabaseClient.auth.getSession();
            if (session) {
                showDashboard();
            } else {
                showLogin();
            }
        } catch (e) {
            console.error(e);
            showLogin();
        }
    }

    function showLogin() {
        authSection.classList.remove("hidden");
        dashboardSection.classList.add("hidden");
        loginError.textContent = "";
    }

    function showDashboard() {
        authSection.classList.add("hidden");
        dashboardSection.classList.remove("hidden");
        crudStatus.textContent = "";
        renderAdminTable();
    }

    // LOGIN ACTION
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        AudioSystem.click();
        
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;
        
        if (!isSupabaseConfigured) {
            // Bypass login for offline configuration
            showDashboard();
            return;
        }

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
            if (error) throw error;
            
            showDashboard();
        } catch (err) {
            loginError.textContent = `Error: ${err.message || "Credenciales inválidas"}`;
        }
    });

    // LOGOUT ACTION
    logoutBtn.addEventListener("click", async () => {
        AudioSystem.click();
        
        if (isSupabaseConfigured) {
            await supabaseClient.auth.signOut();
        }
        
        showLogin();
    });

    // RENDER ADMIN LIST TABLE
    function renderAdminTable() {
        tableBody.innerHTML = "";
        
        activeThumbnails.forEach((item) => {
            const tr = document.createElement("tr");
            
            tr.innerHTML = `
                <td>
                    <img class="admin-table-img" src="${item.image_url}" alt="Preview" onerror="this.src=''; this.style.backgroundColor='${item.primary_color || '#333'}';">
                </td>
                <td style="font-weight: 600;">${item.title}</td>
                <td>
                    <div class="table-actions">
                        <button class="btn-table edit magnet-target" data-id="${item.id}">Editar</button>
                        <button class="btn-table delete magnet-target" data-id="${item.id}">Borrar</button>
                    </div>
                </td>
            `;
            
            tableBody.appendChild(tr);
        });

        // Add Listeners to CRUD buttons
        tableBody.querySelectorAll(".btn-table.edit").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const id = e.target.getAttribute("data-id");
                loadItemToForm(id);
            });
        });

        tableBody.querySelectorAll(".btn-table.delete").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (confirm("¿Estás seguro de que quieres eliminar esta miniatura?")) {
                    const id = e.target.getAttribute("data-id");
                    await deleteItem(id);
                }
            });
        });
    }

    // FORM LOAD EDITING ITEM
    function loadItemToForm(id) {
        const item = activeThumbnails.find(x => x.id == id);
        if (!item) return;
        
        AudioSystem.click();
        
        document.getElementById("edit-id").value = item.id;
        document.getElementById("thumb-title").value = item.title;
        document.getElementById("thumb-difficulty").value = item.difficulty;
        document.getElementById("thumb-client").value = item.client;
        document.getElementById("thumb-video-url").value = item.video_url || "";
        document.getElementById("thumb-color-primary").value = item.primary_color || "#ff3333";
        document.getElementById("thumb-color-secondary").value = item.secondary_color || "#ff5e00";
        
        document.getElementById("form-action-title").textContent = "Editar Miniatura";
        cancelEditBtn.classList.remove("hidden");
        
        document.getElementById("thumb-title").focus();
    }

    function resetCRUDForm() {
        crudForm.reset();
        document.getElementById("edit-id").value = "";
        document.getElementById("form-action-title").textContent = "Añadir Nueva Miniatura";
        cancelEditBtn.classList.add("hidden");
        crudStatus.textContent = "";
    }

    cancelEditBtn.addEventListener("click", () => {
        AudioSystem.click();
        resetCRUDForm();
    });

    // DELETE ITEM
    async function deleteItem(id) {
        AudioSystem.click();
        crudStatus.textContent = "Eliminando...";
        
        if (isSupabaseConfigured) {
            try {
                // Delete from DB
                const { error } = await supabaseClient
                    .from('thumbnails')
                    .delete()
                    .eq('id', id);
                    
                if (error) throw error;
                
                // Reload live data
                await loadThumbnailsData();
                renderGrid();
                renderAdminTable();
                crudStatus.textContent = "Miniatura eliminada con éxito.";
            } catch (err) {
                crudStatus.textContent = `Error al eliminar: ${err.message}`;
            }
        } else {
            // Local fallback deletion
            activeThumbnails = activeThumbnails.filter(x => x.id != id);
            renderGrid();
            renderAdminTable();
            crudStatus.textContent = "Miniatura eliminada (Modo Local).";
        }
    }

    // FORM SAVE / SUBMIT (CREATE OR UPDATE)
    crudForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        AudioSystem.click();
        crudStatus.textContent = "Guardando...";
        
        const editId = document.getElementById("edit-id").value;
        const title = document.getElementById("thumb-title").value.trim();
        const difficulty = document.getElementById("thumb-difficulty").value.trim();
        const client = document.getElementById("thumb-client").value.trim();
        const videoUrl = document.getElementById("thumb-video-url").value.trim();
        const primaryColor = document.getElementById("thumb-color-primary").value;
        const secondaryColor = document.getElementById("thumb-color-secondary").value;
        
        const imageFile = document.getElementById("thumb-image").files[0];
        
        let imageUrl = "";
        
        // 1. Handling Image Upload
        if (imageFile) {
            if (isSupabaseConfigured) {
                try {
                    // Upload to Supabase Storage Bucket 'thumbnails'
                    const fileExt = imageFile.name.split('.').pop();
                    const fileName = `${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${fileExt}`;
                    const filePath = `public/${fileName}`;
                    
                    const { data, error: uploadError } = await supabaseClient.storage
                        .from('thumbnails')
                        .upload(filePath, imageFile);
                        
                    if (uploadError) throw uploadError;
                    
                    // Fetch Public URL
                    const { data: { publicUrl } } = supabaseClient.storage
                        .from('thumbnails')
                        .getPublicUrl(filePath);
                        
                    imageUrl = publicUrl;
                } catch (err) {
                    crudStatus.textContent = `Error al subir imagen: ${err.message}`;
                    return;
                }
            } else {
                // Offline fallback image conversion to Base64 (so it displays locally)
                try {
                    imageUrl = await convertFileToBase64(imageFile);
                } catch (err) {
                    crudStatus.textContent = "Error al procesar archivo local.";
                    return;
                }
            }
        }
        
        // Assemble save object
        const itemData = {
            title,
            difficulty,
            client,
            video_url: videoUrl,
            primary_color: primaryColor,
            secondary_color: secondaryColor,
            description: "",
            ctr: "",
            time: ""
        };
        
        // Only update image_url if a new image was uploaded
        if (imageUrl) {
            itemData.image_url = imageUrl;
        }

        // 2. Database Save
        if (isSupabaseConfigured) {
            try {
                if (editId) {
                    // UPDATE
                    const { error } = await supabaseClient
                        .from('thumbnails')
                        .update(itemData)
                        .eq('id', editId);
                        
                    if (error) throw error;
                } else {
                    // CREATE
                    // generate simple string id for frontend handling if needed
                    itemData.id = Date.now().toString();
                    // make sure image is present on new creations
                    if (!imageUrl) {
                        itemData.image_url = "assets/thumbnails/placeholder.jpg";
                    }
                    
                    const { error } = await supabaseClient
                        .from('thumbnails')
                        .insert([itemData]);
                        
                    if (error) throw error;
                }
                
                await loadThumbnailsData();
                renderGrid();
                renderAdminTable();
                resetCRUDForm();
                crudStatus.textContent = "Miniatura guardada exitosamente en Supabase.";
            } catch (err) {
                crudStatus.textContent = `Error al guardar: ${err.message}`;
            }
        } else {
            // Local Offline Demo CRUD
            if (editId) {
                // Edit existing
                const index = activeThumbnails.findIndex(x => x.id == editId);
                if (index !== -1) {
                    activeThumbnails[index] = {
                        ...activeThumbnails[index],
                        ...itemData
                    };
                }
            } else {
                // Add new
                const newItem = {
                    id: Date.now().toString(),
                    ...itemData,
                    image_url: imageUrl || "assets/thumbnails/placeholder.jpg"
                };
                activeThumbnails.push(newItem);
            }
            
            renderGrid();
            renderAdminTable();
            resetCRUDForm();
            crudStatus.textContent = "Miniatura guardada (Modo Local).";
        }
    });

    // Helper file to base64
    function convertFileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    }
}

// 13. CONTACT MODAL WITH COPY CLIPBOARD LOGIC
function setupContactModal() {
    const trigger = document.getElementById("contact-trigger");
    const modal = document.getElementById("contact-modal");
    const closeBtn = document.getElementById("close-contact");
    const backdrop = document.getElementById("contact-backdrop");

    function openContact() {
        AudioSystem.click();
        AudioSystem.open();
        modal.classList.add("active");
        document.body.style.overflowY = "hidden";
    }

    function closeContact() {
        AudioSystem.click();
        AudioSystem.close();
        modal.classList.remove("active");
        document.body.style.overflowY = "auto";
    }

    if (trigger) trigger.addEventListener("click", openContact);
    if (closeBtn) closeBtn.addEventListener("click", closeContact);
    if (backdrop) backdrop.addEventListener("click", closeContact);

    // Configurar acción de copiar para cada opción de contacto
    const options = modal.querySelectorAll(".contact-option");
    options.forEach(option => {
        option.addEventListener("click", (e) => {
            const textToCopy = option.getAttribute("data-copy");
            if (!textToCopy) return;

            navigator.clipboard.writeText(textToCopy).then(() => {
                AudioSystem.click();
                
                const statusEl = option.querySelector(".contact-option-arrow");
                const originalText = statusEl.textContent;
                
                statusEl.textContent = "¡Copiado!";
                statusEl.style.color = "#00ff88";
                statusEl.style.textShadow = "0 0 10px rgba(0, 255, 136, 0.4)";
                
                setTimeout(() => {
                    statusEl.textContent = originalText;
                    statusEl.style.color = "";
                    statusEl.style.textShadow = "";
                }, 2000);
            }).catch(err => {
                console.error("Error al copiar: ", err);
            });
        });
    });
}
