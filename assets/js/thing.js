const sites = [
    "news.ycombinator.com",
    "x.com",
]
const ref = (document.referrer || "")

if (sites.some(site => ref.includes(site))) {
    window.location.replace("https://en.wikipedia.org/wiki/Penis");
}