const loginLink = document.querySelector('.nav-actions a[href="login.html"]');
const registerLink = document.querySelector('.nav-actions a[href="registro.html"]');
const profileLink = document.getElementById("profile-link");
const logoutButton = document.getElementById("logout-btn");

function updateDemoSession() {
    const signedIn = sessionStorage.getItem("ceutaplay-demo-session") === "active";
    loginLink.hidden = signedIn;
    registerLink.hidden = signedIn;
    profileLink.hidden = !signedIn;
    logoutButton.hidden = !signedIn;
}

window.addEventListener("pageshow", updateDemoSession);
logoutButton.addEventListener("click", () => {
    sessionStorage.removeItem("ceutaplay-demo-session");
    sessionStorage.removeItem("ceutaplay-profile-name");
    updateDemoSession();
    loginLink.focus();
});
