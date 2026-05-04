/* taken from Nuit version -1 */

const canvas = document.getElementById('star-canvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

const stars = [];

function createStar() {
    return {
        x: Math.random() * canvas.width,
        y: -Math.random() * canvas.height,
        size: Math.random() * 2 + 1,
        baseSpeed: Math.random() * 0.7 + 0.3,
        opacity: Math.random() * 0.5 + 0.5,
        twinkle: Math.random() * 0.05
    };
}

// Create stars
for (let i = 0; i < 25; i++) {
    stars.push(createStar());
}

// Easing control
let speedMultiplier = 20;
let easingTriggered = false;
let easingStartTime = null;
const easeDuration = 3000; // 1 second

function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (easingTriggered && easingStartTime) {
        const elapsed = Date.now() - easingStartTime;
        const t = Math.min(elapsed / easeDuration, 1);
        speedMultiplier = 1 + (20 - 1) * (1 - easeOutExpo(t)); // ease 20 → 1
    }

    for (let star of stars) {
        // Twinkle effect
        star.opacity += (Math.random() - 0.75) * star.twinkle;
        star.opacity = Math.max(0.2, Math.min(star.opacity, 1));

        // Draw star
        ctx.beginPath();
        ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${star.opacity})`;
        ctx.fill();

        // Move
        star.y += star.baseSpeed * speedMultiplier;

        // Trigger easing when first star hits top
        if (!easingTriggered && star.y >= canvas.height) {
            easingTriggered = true;
            easingStartTime = Date.now();
        }

        // Reset if offscreen
        if (star.y > canvas.height + star.size) {
            Object.assign(star, createStar());
            star.y = -star.size;
        }
    }

    requestAnimationFrame(animate);
}

animate();
