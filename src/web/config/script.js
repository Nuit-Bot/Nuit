const guildId = window.location.pathname.split("/")[2]
const module = window.location.pathname.split("/")[3]

let guildData

async function load() {
    document.querySelector("#loading").style.backdropFilter = "blur(12px)";

    try {
        const res = await fetch(`/api/guild/${guildId}`)

        if (!res.ok || res.redirected) {
            return window.location.replace("/dashboard")
        }
        
        guildData = await res.json()

        document.title = `${guildData.name} - Nuit`
    } catch (err) {
        console.error("Something was wrong when loading guild info", err)
    }

    document.querySelector("#loading").style.backdropFilter = "blur(0px)";

    setTimeout(() => {
        document.querySelector("#loading").style.display = "none";
    }, 400);
}

load()