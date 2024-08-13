import { cities, borders } from "./data.js";

let currentIndex = -1;
let geojsonBounds;
let shareStr = "";

function mod(n, m) {
    return ((n % m) + m) % m;
}

function distanceDirection(lon1, lat1, lon2, lat2) {
    const R = 3958.8; // Radius of the Earth in miles

    // Convert degrees to radians
    const toRadians = degrees => degrees * (Math.PI / 180);

    const lat1Rad = toRadians(lat1);
    const lon1Rad = toRadians(lon1);
    const lat2Rad = toRadians(lat2);
    const lon2Rad = toRadians(lon2);

    // Haversine formula
    const deltaLat = lat2Rad - lat1Rad;
    const deltaLon = lon2Rad - lon1Rad;
    const a = Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) *
              Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const distance = Math.round(R * c);

    // Calculate bearing
    const y = Math.sin(lon2Rad - lon1Rad) * Math.cos(lat2Rad);
    const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
              Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(lon2Rad - lon1Rad);
    let bearing = Math.atan2(y, x);
    bearing = bearing * (180 / Math.PI); // Convert to degrees
    bearing = (bearing + 360) % 360; // Normalize to 0-360

    // Determine direction
    const directions = ["↑", "↗️", "➡️", "↘️", "↓", "↙️", "←", "↖️"];
    const directionIndex = Math.round(bearing / 45) % 8;
    const direction = directions[directionIndex];

    return {
        distance: distance,
        direction: direction
    };
}

function hasher() {
    const estOffset = -5 * 60;
    const now = new Date();
    const utc = now.getTime() + (now.getTimezoneOffset() * 60000);
    const estDate = new Date(utc + (60000 * estOffset));

    const year = estDate.getUTCFullYear();
    const month = estDate.getUTCMonth() + 1;
    const day = estDate.getUTCDate();

    const dateString = `${year}-${month}-${day}`;

    let hash = 5381;
    for (let i = 0; i < dateString.length; i++) {
        hash = ((hash << 5) + hash) + dateString.charCodeAt(i);
    }

    hash = (hash ^ 0x5DEECE66D) & ((1 << 31) - 1);
    hash = (hash * 48271) % 2147483647;
    hash = (hash + 0xB) * 0x5A5A5A5A;

    const result = Math.abs(hash) % 179;

    return result;
}

function filterCities(query) {
    if (!query) return [];
    return cities.filter(item => item.city.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
}

function handleInputChange(event) {
    const inputElement = event.target;
    const query = inputElement.value;
    const suggestionsContainer = document.getElementsByClassName("suggestions")[0];

    const filteredCities = filterCities(query);
    displaySuggestions(inputElement, suggestionsContainer, filteredCities);
    currentIndex = -1; // Reset the index when the input changes
}

function displaySuggestions(inputElement, suggestionsContainer, filteredCities) {
    suggestionsContainer.innerHTML = "";

    filteredCities.forEach((suggestedCityData, index) => {
        const li = document.createElement("li");

        const flagImg = document.createElement("img");
        flagImg.classList.add("flag");
        flagImg.src = `flags/${suggestedCityData.state}.png`;
        flagImg.alt = `${suggestedCityData.state} flag`;

        const textNode = document.createTextNode(` ${suggestedCityData.city}, ${suggestedCityData.state}`);

        li.appendChild(flagImg);
        li.appendChild(textNode);

        li.addEventListener("click", () => {
            inputElement.value = `${suggestedCityData.city}, ${suggestedCityData.state}`;
            suggestionsContainer.innerHTML = "";
            suggestionsContainer.classList.remove("suggestions-border");
        });

        // Add mouseover event to reset the highlighted city
        li.addEventListener("mouseover", () => {
            currentIndex = index;
            highlightSuggestion(suggestionsContainer.getElementsByTagName("li"));
        });

        suggestionsContainer.appendChild(li);
    });

    if (filteredCities.length > 0) {
        suggestionsContainer.classList.add("suggestions-border");
    } else {
        suggestionsContainer.classList.remove("suggestions-border");
    }
}


function handleArrowKeyNavigation(event) {
    const suggestionsContainer = document.getElementsByClassName("suggestions")[0];
    const suggestions = suggestionsContainer.getElementsByTagName("li");

    if (suggestions.length > 0) {
        if (event.key === "ArrowDown") {
            currentIndex = (currentIndex + 1) % suggestions.length;
            highlightSuggestion(suggestions);
        } else if (event.key === "ArrowUp") {
            currentIndex = (currentIndex - 1 + suggestions.length) % suggestions.length;
            highlightSuggestion(suggestions);
        } else if (event.key === "Enter") {
            event.preventDefault();
            const inputElement = document.getElementById("enter-guess");
            if (currentIndex >= 0 && currentIndex < suggestions.length) {
                inputElement.value = suggestions[currentIndex].textContent.trim();
                suggestionsContainer.innerHTML = "";
                suggestionsContainer.classList.remove("suggestions-border");
            } else {
                handleSubmit();
            }
        }
    } else if (event.key === "Enter") {
        handleSubmit();
    }
}

function highlightSuggestion(suggestions) {
    for (let i = 0; i < suggestions.length; i++) {
        if (i === currentIndex) {
            suggestions[i].classList.add("highlighted");
        } else {
            suggestions[i].classList.remove("highlighted");
        }
    }
}

function handleSubmit(target) {
    const inputValue = document.getElementById("enter-guess").value.trim();
    const [guessedCity, guessedState] = inputValue.split(",").map(part => part.trim());

    const guessedCityData = cities.find(c =>
        c.city.toLowerCase() === guessedCity.toLowerCase() && c.state.toLowerCase() === guessedState.toLowerCase()
    );

    if (guessedCityData) {
        addGuess(guessedCityData, target);
        if (guessedCity === target.city && guessedState === target.state) { // player guessed correctly
            endGame();
        }
    } else {
        alert("Invalid city or state");
    }
}

function addGuess(guessedCityData, target) {
    shareStr += buildShareStr(guessedCityData, target);

    const rows = document.querySelectorAll(".guess-made");
    for (const row of rows) {
        const fillerCells = row.getElementsByClassName("filler-td");
        if (fillerCells.length === 1) {
            row.innerHTML = "";
            row.classList.remove("clear-bg");

            var cityTd = cityFactory(guessedCityData, target);
            var stateTd = stateFactory(guessedCityData, target);
            var popTd = popFactory(guessedCityData, target);
            var ddTd = ddFactory(guessedCityData, target);
            const cells = [cityTd, stateTd, popTd, ddTd];

            // append cells to row with sequential delays
            cells.forEach((cell, index) => {
                cell.style.animationDelay = `${index * 0.5}s`;
                row.appendChild(cell);
            });

            // trigger reflow to restart animation
            row.offsetHeight;
            break;
        }
    }

    if (Array.from(rows).every(row => row.getElementsByClassName("filler-td").length !== 1)) {
        endGame();
    }

    return { city: cityTd, state: stateTd, pop: popTd, distance: ddTd };
}

function cityFactory(guessedCityData, target) {
    const cityTd = document.createElement("td");
    cityTd.classList.add("city-td");
    cityTd.textContent = guessedCityData.city;
    if (guessedCityData.city === target.city && guessedCityData.state === target.state) {
        cityTd.classList.add("correct");
    } else {
        cityTd.classList.add("incorrect");
    }
    return cityTd;
}

function stateFactory(guessedCityData, target) {
    const stateTd = document.createElement("td");
    stateTd.classList.add("state-td");

    const flagImg = document.createElement("img");
    flagImg.classList.add("flag");
    flagImg.src = `flags/${guessedCityData.state}.png`;
    flagImg.alt = `${guessedCityData.state} flag`;

    const textNode = document.createTextNode(guessedCityData.state);

    stateTd.appendChild(flagImg);
    stateTd.appendChild(textNode);

    if (guessedCityData.state === target.state) {
        stateTd.classList.add("correct");
    } else if (borders[target.state].includes(guessedCityData.state)) {
        stateTd.classList.add("neighbor");
    } else {
        stateTd.classList.add("incorrect");
    }
    return stateTd;
}

function popFactory(guessedCityData, target) {
    const popTd = document.createElement("td");
    popTd.classList.add("pop-td");

    // check if pop is correct
    if (guessedCityData.pop === target.pop) {
        popTd.textContent = "✅ " + target.pop.toLocaleString();
        popTd.classList.add("correct");
        return popTd;
    }

    // add yellow background for same hundred thousands place
    const guessedMillions = Math.floor(guessedCityData.pop / 1000000) % 10;
    const guessedHundredThousands = Math.floor(guessedCityData.pop / 100000) % 10;
    const targetMillions = Math.floor(target.pop / 1000000) % 10;
    const targetHundredThousands = Math.floor(target.pop / 100000) % 10;
    if (guessedMillions === targetMillions && guessedHundredThousands === targetHundredThousands) {
        popTd.classList.add("neighbor");
    } else {
        popTd.classList.add("incorrect");
    }

   popTd.textContent = guessedCityData.pop.toLocaleString();
    if (guessedCityData.pop > target.pop) {
        popTd.textContent = "↓ " + popTd.textContent;
    } else {
        popTd.textContent = "↑ " + popTd.textContent;
    }

    return popTd;
}

function ddFactory(guessedCityData, target) {
    const guessedLon = guessedCityData.lon;
    const guessedLat = guessedCityData.lat;
    const targetLon = target.lon;
    const targetLat = target.lat;

    var { distance, direction } = distanceDirection(guessedLon, guessedLat, targetLon, targetLat);
    const ddTd = document.createElement("td");
    ddTd.textContent = `${direction} ${distance} mi`;
    ddTd.classList.add("dd-td");
    if (distance === 0) {
        ddTd.classList.add("correct");
        ddTd.textContent = "✅ 0 mi";
    } else {
        ddTd.classList.add("incorrect");
    }
    return ddTd;
}

function endGame() {
    document.getElementById("enter-guess").remove();
    document.getElementById("submit").remove();
    const share = document.createElement("button");
    share.textContent = "Share";
    share.id = "share";
    document.getElementById("current-guess").appendChild(share);

    document.getElementById("share").addEventListener("click", function() {
        const now = new Date();
        const estDate = now.toLocaleDateString('en-US', {
            timeZone: 'America/New_York',
            day: 'numeric',
            month: 'numeric',
            year: '2-digit'
        });
        const municipleURL = "";
        const shareStrLabeled = `Municiple ${estDate}\n${shareStr.trimEnd()} ${municipleURL}`;
        navigator.clipboard.writeText(shareStrLabeled);
    })
}

function main() {
    console.log(cities);
    const map = L.map("map", {
        zoomSnap: 0.1,
        dragging: false,
        zoomControl: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false
    }).setView([26.0112, -80.1495], 13);

    // establish target city
    const index = hasher();
    const target = cities[index];
    displayExampleTables();

    const geojsonPath = `shp/${target.city},${target.state}.geojson`.replace(" ", "");
    const geojsonLayer = L.geoJSON().addTo(map);
    fetch(geojsonPath)
        .then(response => response.json())
        .then(data => {
            geojsonLayer.addData(data);
            geojsonBounds = geojsonLayer.getBounds();
            map.fitBounds(geojsonBounds);
        })
        .catch(err => console.error(err));
    window.addEventListener("resize", () => {
        if (geojsonBounds) {
            map.fitBounds(geojsonBounds);
        }
    });

    const input = document.getElementById("enter-guess");
    const suggestions = document.getElementsByClassName("suggestions")[0];
    if (input) {
        input.addEventListener("input", handleInputChange);
        input.addEventListener("keydown", handleArrowKeyNavigation);
    }

    document.getElementById("submit").addEventListener("click", () => handleSubmit(target));
    document.getElementById("info").addEventListener("click", function() {
        document.getElementById("info-popup").classList.toggle("visible");
    })
}

function displayExampleTable(tableId, guessedCityData, target) {
    const table = document.getElementById(tableId);
    table.classList.add("guesses");
    const tr = document.createElement("tr");
    table.appendChild(tr);
    tr.appendChild(cityFactory(guessedCityData, target));
    tr.appendChild(stateFactory(guessedCityData, target));
    tr.appendChild(popFactory(guessedCityData, target));
    tr.appendChild(ddFactory(guessedCityData, target));
}

// load in example tables
function displayExampleTables() {
    const exCities = [
        cities[25],
        cities[32],
        cities[33],
        cities[34]
    ]

    for (let i = 0; i < exCities.length; i++) {
        displayExampleTable(`ex${i}`, exCities[i], exCities[exCities.length - 1]);
    }

}

function buildShareStr(guessedCityData, target) {
    var shareStr_ = "";
    
    // city
    if (guessedCityData.city === target.city && guessedCityData.state === target.state) {
        shareStr_ += "🟥";
    } else {
        shareStr_ += "🟩";
    }

    // state
    if (guessedCityData.state === target.state) {
        shareStr_ += "🟩";
    } else if (borders[target.state].includes(guessedCityData.state)) {
        shareStr_ += "🟨";
    } else {
        shareStr_ += "🟥";
    }

    // pop
    const guessedMillions = Math.floor(guessedCityData.pop / 1000000) % 10;
    const guessedHundredThousands = Math.floor(guessedCityData.pop / 100000) % 10;
    const targetMillions = Math.floor(target.pop / 1000000) % 10;
    const targetHundredThousands = Math.floor(target.pop / 100000) % 10;
    if (guessedCityData.pop === target.pop) {
        shareStr_ += "🟩";
    } else if (guessedMillions === targetMillions && guessedHundredThousands === targetHundredThousands) {
        shareStr_ += "🟨";
    } else {
        shareStr_ += "🟥";
    }

    // distance/direction
    const distance = distanceDirection(guessedCityData.lon, guessedCityData.lat, target.lon, target.lat).distance;
    if (distance === 0) {
        shareStr_ += "🟩";
    } else if (distance < 100) {
        shareStr_ += "🟨";
    } else {
        shareStr_ += "🟥";
    }

    return shareStr_ + "\n";
}

main();