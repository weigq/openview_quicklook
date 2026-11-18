let arrowRight = chrome.runtime.getURL('right-arrow.svg');
let arrowLeft = chrome.runtime.getURL('left-arrow.svg');

function getFieldValue(content, fieldName) {
    const field = content ? content[fieldName] : null;
    if (field == null) {
        return null;
    }
    return typeof field === 'object' && 'value' in field ? field.value : field;
}

function extractRatingValue(rawRating) {
    if (typeof rawRating === 'number') {
        return rawRating.toString();
    }
    if (typeof rawRating !== 'string') {
        return null;
    }

    const ratingText = rawRating.trim();
    // Most venues use "8: description"; ACL ARR uses "2.5 = Borderline Findings".
    const numericMatch = ratingText.match(/^(-?\d+(?:\.\d+)?)(?=\s*(?:[:=\-–—]|$))/);
    if (numericMatch != null) {
        return numericMatch[1];
    }

    // Preserve the previous behavior for non-numeric, labeled ratings.
    const labelMatch = ratingText.match(/^(.*?)\s*(?::|=)/);
    return labelMatch != null ? labelMatch[1] : ratingText;
}

function getReviewRating(content) {
    const fields = [
        'rating',                  // NeurIPS, ICML, ICLR 2025+, etc.
        'recommendation',          // ICLR 2023 and 2024
        'preliminary_rating',      // ACM MM
        'overall_assessment',      // ACL Rolling Review (ARR)
        'overall_recommendation',  // CVPR
        'final_rating'
    ];

    for (const field of fields) {
        const value = getFieldValue(content, field);
        if (value != null) {
            return value;
        }
    }
    return null;
}

function mainFunc() {
    // clear history
    let href = window.location.href.match(/forum\?id=(.[^&^#]*)(&.*)?(#.*)?/);
    if (href == null) {}
    else {
        let id = href.at(1);
        fetch('https://api2.openreview.net/notes?forum=' + id, {
            method: 'GET',
            headers: {'Content-Type': 'application/json; charset=utf-8'},
            credentials: 'include',
        })
            .then(response => response.json())
            .then(data1 => {
                if (data1 === null || data1.notes.length === 0) {
                    return fetch('https://api.openreview.net/notes?forum=' + id, {
                        method: 'GET',
                        headers: {'Content-Type': 'application/json; charset=utf-8'},
                        credentials: 'include',
                    })
                        .then(response => response.json())
                        .then(data2 => {
                            parseData(
                                data2.notes.filter(e => e.replyto === id && e.invitation.toLowerCase().includes('official_review')).sort((a, b) => b.number - a.number),
                                data2.notes.filter(e => e.replyto === id && e.invitation.toLowerCase().includes('decision') && 'content' in e ? 'decision' in e.content : false),
                                );
                        })
                        .catch((error) => {console.error('Error: ' + error)})
                } else {
                    parseData(
                        data1.notes.filter(e => e.replyto === id && e.invitations[0].toLowerCase().includes('official_review')).sort((a, b) => b.number - a.number),
                        data1.notes.filter(e => e.replyto === id && e.invitations[0].toLowerCase().includes('decision') && 'content' in e ? 'decision' in e.content : false),
                        );
                }
            })
            .catch((error) => {console.error('Error: ' + error)})
    }
}

function parseData(reviews, decision) {
    if (reviews.length === 0) {return;}
    // create new div
    let sumNav = document.createElement('div');
    sumNav.className = 'sum-nav';
    // parse data
    let ratings = [];
    let tableStr = "<table id='sum-tbl' style='display: table'><tr><td class='scd' colspan='2'><a href='https://github.com/weigq/openview_quicklook'>Quick👀Look</a></td></tr>";
    reviews.forEach((elem, i) => {
        const rawRating = getReviewRating(elem.content);
        if (rawRating == null) {}
        else {
            const rating = extractRatingValue(rawRating);

            tableStr += "<tr class='clk-tr' data-href=" + elem.id + "><td class='fst'>R" + (i + 1) + ":</td><td class='scd'>" + rating + "</td></tr>";
            ratings.push(rating);
        }
    });

    // Show an average only when every displayed rating is numeric.
    const numericRatings = ratings.map(rating => Number(rating));
    if (ratings.length > 0 && numericRatings.every(rating => Number.isFinite(rating))) {
        const avg_rating = numericRatings.reduce((a, b) => a + b, 0) / numericRatings.length;
        tableStr += "<tr class='last'><td class='fst'>avg:</td><td class='scd'>" + avg_rating.toFixed(2) + "</td></tr>";
    }

    // decision
    if (decision.length > 0) {
        const decision_value = getFieldValue(decision[0].content, 'decision');
        tableStr += "<tr class='last'><td colspan='2' class='scd'>" + decision_value + "</td></tr>";
    }
    tableStr += "</table>";
    tableStr += "<div class='nav-btn'><img id='nav-arrow' src=" + arrowLeft + "></div>"
    sumNav.insertAdjacentHTML('afterbegin', tableStr);
    document.body.append(sumNav);
    addClick();
}

const getOffsetTop = element => {
    let offsetTop = 0;
    while(element) {
        offsetTop += element.offsetTop;
        element = element.offsetParent;
    }
    return offsetTop;
}

function addClick() {
    let trs = document.querySelectorAll('.clk-tr');
    trs.forEach((e, i) => {
        e.addEventListener('click', () => {
            let href = e.getAttribute('data-href');
            let elem;
            if (document.querySelector("[data-id='" + href + "']") != null) {
                elem = document.querySelector("[data-id='" + href + "']");  // neurips23
            } else {
                elem = document.getElementById("note_" + href);  // before neurips23
            }
            let y = getOffsetTop(elem);
            window.scroll({top: y - 75, behavior: 'smooth' });
        })
    })
    let arrow = document.getElementById('nav-arrow');
    arrow.addEventListener('click', () => {
        let sumTbl = document.getElementById('sum-tbl');
        sumTbl.getBoundingClientRect().left >= 0 ? (arrow.src = arrowRight, sumTbl.style.transform = 'translateX(-200%)') : (arrow.src = arrowLeft, sumTbl.style.transform = 'translateX(0)');
    })
}

// clear history
function clearSummary() {
    let sumNav = document.getElementsByClassName('sum-nav');
    while (sumNav.length > 0) {
        sumNav[0].parentNode.removeChild(sumNav[0]);
    }
}

// tab update
chrome.runtime.onMessage.addListener(function (request, sender, sendResponse) {
    if (request.message === 'TabUpdated') { clearSummary(); mainFunc(); }
})

// leaving tab
window.addEventListener('beforeunload', function(e) { clearSummary() })

