let userData;
let commonGuilds;

const guildTemplate = document.querySelector("template.guild")
const guildList = document.getElementById("guildList")

async function load() {
    document.querySelector("#loading").style.backdropFilter = "blur(12px)";

    try {
        const res = await fetch("/api/users/@me");

        if (!res.ok) {
            window.location.replace("/auth/discord/login");
        }

        userData = await res.json();
    } catch (err) {
        console.error("Something went wrong while loading user data", err);
    }

    try {
        const res = await fetch("/api/guilds/common");

        if (!res.ok) {
            window.location.replace("/auth/discord/login");
        }

        commonGuilds = await res.json();

        console.log(commonGuilds)
    } catch (err) {
        console.error("Something went wrong while fetching common servers", err)
    }

    commonGuilds.forEach(guild => {
        const clone = document.importNode(guildTemplate.content, true)

        clone.querySelector("img.icon").src = `https://cdn.discordapp.com/icons/${guild.id}/${guild.icon}.png?size=64`
        clone.querySelector("h3.name").textContent = guild.name

        guildList.appendChild(clone)
    });

    document.querySelector("#loading").style.backdropFilter = "blur(0px)";

    setTimeout(() => {
        document.querySelector("#loading").style.display = "none";
    }, 400);
}

load();
