let arrowRight = chrome.extension.getURL('right-arrow.svg');
let arrowLeft = chrome.extension.getURL('left-arrow.svg');

function mainFunc() {
    // clear history
    let href = window.location.href.match(/forum\?id=(.[^&^#]*)(&.*)?(#.*)?/);
    if (href == null) {}
    else {
        let id = href.at(1);
        fetch('https://api.openreview.net/notes?forum=' + id, {
            method: 'GET',
            headers: {'Content-Type': 'application/json; charset=utf-8'},
        })
            .then(response => response.json())
            .then(data => {
                parseData(
                    data.notes.filter(e => e.replyto === id && e.invitation.toLowerCase().includes('review')).sort((a, b) => b.number - a.number),
                    data.notes.filter(e => e.replyto === id && e.invitation.toLowerCase().includes('decision') && 'content' in e ? 'decision' in e.content : false),
                    );
            })
            .catch((error) => {console.error('Error: ' + error)})
}}

function parseData(reviews, decision) {
    if (reviews.length === 0) {return;}
    // create new div
    let sumNav = document.createElement('div');
    sumNav.className = 'sum-nav';
    // parse data
    let ratings = [], ratingFlag = null;
    let tableStr = "<table id='sum-tbl' style='display: table'><tr><td class='scd' colspan='2'>Quick👀Look</td></tr>";
    reviews.forEach((e, i) => {
        let f = e.content.rating != null ? e.content.rating : (e.content.recommendation != null ? e.content.recommendation : null)
        if (f == null) {}
        else {
            let rating = f.match(/(.*):/).at(1);
            ratingFlag = (ratingFlag == null ? rating.match(/\d*/)[0].length === rating.length : ratingFlag);
            tableStr += "<tr class='clk-tr' data-href='note_" + e.id + "'><td class='fst'>R" + i + ":</td><td class='scd'>" + rating + "</td></tr>";
            ratings.push(rating);
        }
    });
    // rating is score
    if (ratingFlag === true) {
        let _rating = ratings.reduce((a, b) => parseInt(a, 10) + parseInt(b, 10)) / ratings.length;
        tableStr += "<tr class='last'><td class='fst'>avg:</td><td class='scd'>" + _rating.toFixed(2) + "</td></tr>";
    }
    if (decision.length > 0) {
        tableStr += "<tr class='last'><td colspan='2' class='scd'>" + decision[0].content.decision + "</td></tr>";
    }
    tableStr += "</table>";
    tableStr += "<div class='nav-btn'><img id='nav-arrow' src=" + arrowLeft + "></div>"
    sumNav.insertAdjacentHTML('afterbegin', tableStr);
    document.body.append(sumNav);
    addClick();
}

function addClick() {
    let trs = document.querySelectorAll('.clk-tr');
    trs.forEach((e, i) => {
        e.addEventListener('click', () => {
            let href = e.getAttribute('data-href');
            let y = document.getElementById(href).parentNode.offsetTop;
            window.scroll({top: y - 50, behavior: 'smooth' });
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

