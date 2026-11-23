const loginForm = document.getElementById("login-form");
const loginStatus = document.getElementById("login-status");
const registrationName = document.getElementById("registration-name");

loginForm.addEventListener("input", () => {
    loginStatus.textContent = "";
});

loginForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const email = document.getElementById("email").value.trim().toLowerCase();
    const profileKey = `ceutaplay-demo-profile:${email}`;
    let name = localStorage.getItem(profileKey);

    if (registrationName) {
        name = registrationName.value.trim();
        if (!name) {
            loginStatus.textContent = "Escribe un nombre visible.";
            registrationName.focus();
            return;
        }
        localStorage.setItem(profileKey, name);
    }

    if (name) sessionStorage.setItem("ceutaplay-profile-name", name);
    else sessionStorage.removeItem("ceutaplay-profile-name");
    sessionStorage.setItem("ceutaplay-demo-session", "active");
    window.location.replace("index.html");
});
