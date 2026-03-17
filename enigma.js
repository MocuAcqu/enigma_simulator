// --- 1. Enigma 核心邏輯 ---
class EnigmaCore {
    constructor() {
        // Enigma I 轉子資料
        this.ROTOR_DATA = {
            'I':   { wiring: 'EKMFLGDQVZNTOWYHXUSPAIBRCJ', notch: 'Q' },
            'II':  { wiring: 'AJDKSIRUXBLHWTMCQGZNPYFVOE', notch: 'E' },
            'III': { wiring: 'BDFHJLCPRTXVZNYEIWGAKMUSQO', notch: 'V' },
            'IV':  { wiring: 'ESOVPZJAYQUIRHXLNFTGKDCMWB', notch: 'J' },
            'V':   { wiring: 'VZBRGITYUPSDNHLXAWMJQOFECK', notch: 'Z' }
        };
        // 反射器 B
        this.REFLECTOR = 'YRUHQSLDPXNGOKMIEBFZCWVJAT';
    }

    charToIndex(c) { return c.charCodeAt(0) - 65; }
    indexToChar(i) { return String.fromCharCode(((i + 26) % 26) + 65); }

    // 單字元處理 (按鍵時觸發)
    processLetter(char, rotors, plugboardMap) {
        let stateBefore = rotors.map(r => this.indexToChar(r.pos)).join('-');

        // 1. 步進 (Stepping)
        let rotateM = (rotors[2].pos === rotors[2].notch || rotors[1].pos === rotors[1].notch);
        let rotateL = (rotors[1].pos === rotors[1].notch);

        if (rotateL) rotors[0].pos = (rotors[0].pos + 1) % 26;
        if (rotateM) rotors[1].pos = (rotors[1].pos + 1) % 26;
        rotors[2].pos = (rotors[2].pos + 1) % 26; // 右轉子每次必轉

        let stateAfter = rotors.map(r => this.indexToChar(r.pos)).join('-');

        // 2. 進入接線板
        let c = plugboardMap[char] || char;
        let n = this.charToIndex(c);

        // 3. 正向通過轉子
        for (let i = 2; i >= 0; i--) n = this.rotorPass(n, rotors[i], true);

        // 4. 反射器
        n = this.charToIndex(this.REFLECTOR[n]);

        // 5. 反向通過轉子
        for (let i = 0; i <= 2; i++) n = this.rotorPass(n, rotors[i], false);

        // 6. 出接線板
        let finalChar = this.indexToChar(n);
        let outputChar = plugboardMap[finalChar] || finalChar;

        console.log(`輸入: ${char} | 轉動前: ${stateBefore} -> 轉動後: ${stateAfter} | 輸出: ${outputChar}`);

        return { char: outputChar, newPos: rotors.map(r => r.pos) };
    }

    rotorPass(n, rotor, forward) {
        let offset = rotor.pos - rotor.ring;
        let input = (n + offset + 26) % 26;
        let output;

        if (forward) {
            output = this.charToIndex(rotor.wiring[input]);
        } else {
            output = rotor.wiring.indexOf(this.indexToChar(input));
        }
        return (output - offset + 26) % 26;
    }
}

// --- 2. 網頁 UI 互動與管理 ---
const core = new EnigmaCore();
const QWERTZ = ["QWERTZUIO", "ASDFGHJK", "PYXCVBNML"];
let currentRotors = [
    { type: 'I', ring: 0, pos: 0, notch: core.charToIndex('Q'), wiring: core.ROTOR_DATA['I'].wiring },
    { type: 'II', ring: 0, pos: 0, notch: core.charToIndex('E'), wiring: core.ROTOR_DATA['II'].wiring },
    { type: 'III', ring: 0, pos: 0, notch: core.charToIndex('V'), wiring: core.ROTOR_DATA['III'].wiring }
];
let plugboardMap = {};

// 初始化 DOM
document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initRotorsUI();
    initBoardUI('lightboard', 'light');
    initBoardUI('keyboard', 'key');
    initVisualPlugboard(); 
    initInfoModals();
    initImageModal();
});

// 導覽列切換
function initNavigation() {
    const navBtns = document.querySelectorAll('.nav-btn');
    const pages = document.querySelectorAll('.page');

    navBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            navBtns.forEach(b => b.classList.remove('active'));
            pages.forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });
}

// 建立轉子 UI
function initRotorsUI() {
    const container = document.getElementById('rotors-container');
    container.innerHTML = '';
    const labels = ['左轉子', '中轉子', '右轉子'];
    const allTypes = ['I', 'II', 'III', 'IV', 'V'];

    for (let i = 0; i < 3; i++) {
        let rDiv = document.createElement('div');
        rDiv.className = 'rotor';
        
        // 建立下拉選單選項
        let optionsHtml = allTypes.map(t => {
            return `<option value="${t}" ${currentRotors[i].type === t ? 'selected' : ''}>${t}</option>`;
        }).join('');

        rDiv.innerHTML = `
            <div class="rotor-label">${labels[i]}</div>
            <select id="rotor-type-${i}" class="rotor-select" title="轉子選擇">
                ${optionsHtml}
            </select>
            <div class="ring-control">
                <label>環設定</label>
                <input type="number" id="rotor-ring-${i}" min="1" max="26" value="1" title="Ringstellung">
            </div>
            <button class="rotor-btn" onclick="stepRotorManual(${i}, -1)">▲</button>
            <div class="rotor-window" id="rotor-pos-${i}">A</div>
            <button class="rotor-btn" onclick="stepRotorManual(${i}, 1)">▼</button>
        `;
        container.appendChild(rDiv);

        // 綁定事件
        const selectEl = document.getElementById(`rotor-type-${i}`);
        selectEl.addEventListener('change', (e) => {
            updateRotorType(i, e.target.value);
        });

        document.getElementById(`rotor-ring-${i}`).addEventListener('change', (e) => {
            currentRotors[i].ring = parseInt(e.target.value) - 1;
        });
    }
    
    // 初始化時先檢查一次禁用狀態
    updateRotorDropdowns();
    updateRotorDisplay();
}

// 更新轉子類型並觸發下拉選單檢查
function updateRotorType(index, newType) {
    currentRotors[index].type = newType;
    currentRotors[index].wiring = core.ROTOR_DATA[newType].wiring;
    currentRotors[index].notch = core.charToIndex(core.ROTOR_DATA[newType].notch);
    
    // 每次更改後，重新評估所有下拉選單的禁用狀態
    updateRotorDropdowns();
}

// 核心邏輯：禁用已選擇的選項
function updateRotorDropdowns() {
    // 收集當前三個轉子選擇的值
    const selectedVals = [
        document.getElementById('rotor-type-0').value,
        document.getElementById('rotor-type-1').value,
        document.getElementById('rotor-type-2').value
    ];

    for (let i = 0; i < 3; i++) {
        const select = document.getElementById(`rotor-type-${i}`);
        const options = select.options;
        
        for (let j = 0; j < options.length; j++) {
            const optVal = options[j].value;
            // 如果這個選項的值，存在於「另外兩個轉子」的選擇中，就禁用它
            if (selectedVals.includes(optVal) && selectedVals[i] !== optVal) {
                options[j].disabled = true;
                // 加一點視覺提示
                options[j].style.color = '#999'; 
            } else {
                options[j].disabled = false;
                options[j].style.color = '';
            }
        }
    }
}

function stepRotorManual(index, dir) {
    currentRotors[index].pos = (currentRotors[index].pos + dir + 26) % 26;
    updateRotorDisplay();
}

function updateRotorDisplay() {
    for (let i = 0; i < 3; i++) {
        document.getElementById(`rotor-pos-${i}`).innerText = core.indexToChar(currentRotors[i].pos);
    }
}

// 建立鍵盤與燈泡板
function initBoardUI(containerId, elementClass) {
    const container = document.getElementById(containerId);
    QWERTZ.forEach(rowChars => {
        let rowDiv = document.createElement('div');
        rowDiv.className = 'board-row';
        for (let char of rowChars) {
            let el = document.createElement('div');
            el.className = elementClass;
            el.id = `${elementClass}-${char}`;
            el.innerText = char;
            
            // 如果是鍵盤，綁定點擊事件
            if (elementClass === 'key') {
                el.addEventListener('mousedown', () => handleKeyPress(char));
                el.addEventListener('mouseup', () => handleKeyRelease(char));
                el.addEventListener('mouseleave', () => handleKeyRelease(char));
            }
            rowDiv.appendChild(el);
        }
        container.appendChild(rowDiv);
    });
}

// 實體鍵盤綁定
window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    let char = e.key.toUpperCase();
    if (/^[A-Z]$/.test(char) && document.activeElement.tagName !== "INPUT") {
        document.getElementById(`key-${char}`).classList.add('active');
        handleKeyPress(char);
    }
});
window.addEventListener('keyup', (e) => {
    let char = e.key.toUpperCase();
    if (/^[A-Z]$/.test(char) && document.activeElement.tagName !== "INPUT") {
        document.getElementById(`key-${char}`).classList.remove('active');
        handleKeyRelease(char);
    }
});

// 處理按鍵加密邏輯
let activeLight = null;
function handleKeyPress(char) {
    // 1. 處理加密與步進
    let result = core.processLetter(char, currentRotors, plugboardMap);
    
    // 2. 更新轉子視窗 UI
    updateRotorDisplay();

    // 3. 點亮燈泡
    activeLight = result.char;
    document.getElementById(`light-${activeLight}`).classList.add('on');

    // 4. 寫入紙條
    const paper = document.getElementById('paper-strip');
    // 每 5 個字母加一個空白 (軍規格式)
    let text = paper.value.replace(/\s/g, '');
    text += activeLight;
    paper.value = text.match(/.{1,5}/g)?.join(' ') || text;
    paper.scrollTop = paper.scrollHeight;
}

function handleKeyRelease(char) {
    if (activeLight) {
        document.getElementById(`light-${activeLight}`).classList.remove('on');
        activeLight = null;
    }
}

// 接線板邏輯
let selectedSocket = null; 
const cablesData = []; // 儲存已連接的線： { char1, char2, color }

function initVisualPlugboard() {
    const container = document.getElementById('sockets-container');
    container.innerHTML = '';
    
    // QWERTZ 排列
    QWERTZ.forEach(rowChars => {
        let rowDiv = document.createElement('div');
        rowDiv.className = 'socket-row';
        for (let char of rowChars) {
            let wrap = document.createElement('div');
            wrap.className = 'socket-wrapper';
            wrap.innerHTML = `
                <div class="socket-label">${char}</div>
                <div class="socket" id="socket-${char}" data-char="${char}"></div>
            `;
            rowDiv.appendChild(wrap);
        }
        container.appendChild(rowDiv);
    });

    // 綁定點擊事件
    document.querySelectorAll('.socket').forEach(socket => {
        socket.addEventListener('click', () => handleSocketClick(socket.dataset.char));
    });

    // 當視窗縮放時，重新繪製電線（因為座標會改變）
    window.addEventListener('resize', drawCables);
}

function handleSocketClick(char) {
    const socketEl = document.getElementById(`socket-${char}`);

    // 情境 1: 這個插孔已經有插線了 -> 拔除它
    if (plugboardMap[char]) {
        let pairedChar = plugboardMap[char];
        
        // 從邏輯地圖中刪除
        delete plugboardMap[char];
        delete plugboardMap[pairedChar];
        
        // 拔除視覺插頭
        document.getElementById(`socket-${char}`).classList.remove('plugged');
        document.getElementById(`socket-${pairedChar}`).classList.remove('plugged');
        
        // 從電纜資料中移除
        const index = cablesData.findIndex(c => c.char1 === char || c.char2 === char);
        if (index > -1) cablesData.splice(index, 1);
        
        drawCables();
        return;
    }

    // 情境 2: 目前沒有選取的插孔 -> 設為第一個點擊
    if (!selectedSocket) {
        selectedSocket = char;
        socketEl.classList.add('selected');
        return;
    }

    // 情境 3: 點擊了同一個插孔 -> 取消選取
    if (selectedSocket === char) {
        socketEl.classList.remove('selected');
        selectedSocket = null;
        return;
    }

    // 情境 4: 點擊了第二個不同的空插孔 -> 建立連接
    // 最多 10 條線 (20 個字母)
    if (Object.keys(plugboardMap).length >= 20) {
        alert("接線板最多只能插 10 條電纜！");
        document.getElementById(`socket-${selectedSocket}`).classList.remove('selected');
        selectedSocket = null;
        return;
    }

    // 邏輯連接
    plugboardMap[selectedSocket] = char;
    plugboardMap[char] = selectedSocket;

    // 視覺更新
    document.getElementById(`socket-${selectedSocket}`).classList.remove('selected');
    document.getElementById(`socket-${selectedSocket}`).classList.add('plugged');
    socketEl.classList.add('plugged');

    // 記錄並畫線 (稍微用點顏色區分電線)
    const wireColors = ['#9E9E9E', '#BDBDBD', '#757575', '#E0E0E0', '#8D6E63'];
    cablesData.push({
        char1: selectedSocket,
        char2: char,
        color: wireColors[cablesData.length % wireColors.length]
    });

    selectedSocket = null;
    drawCables();
}

function drawCables() {
    const svg = document.getElementById('cables-layer');
    const board = document.getElementById('visual-plugboard');
    const boardRect = board.getBoundingClientRect();
    
    svg.innerHTML = ''; // 清空畫布

    cablesData.forEach(cable => {
        const el1 = document.getElementById(`socket-${cable.char1}`);
        const el2 = document.getElementById(`socket-${cable.char2}`);
        
        const rect1 = el1.getBoundingClientRect();
        const rect2 = el2.getBoundingClientRect();

        // 計算相對於 SVG 畫布的中心座標
        const x1 = rect1.left - boardRect.left + (rect1.width / 2);
        const y1 = rect1.top - boardRect.top + (rect1.height / 2);
        const x2 = rect2.left - boardRect.left + (rect2.width / 2);
        const y2 = rect2.top - boardRect.top + (rect2.height / 2);

        // 使用貝茲曲線畫出「自然下垂」的電纜
        // 控制點 (Control Points) 往下偏移，模擬重力
        const droop = 80; // 下垂程度
        const pathData = `M ${x1} ${y1} C ${x1} ${y1 + droop}, ${x2} ${y2 + droop}, ${x2} ${y2}`;

        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", pathData);
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", cable.color);
        path.setAttribute("stroke-width", "6");
        path.setAttribute("stroke-linecap", "round");
        
        // 加上陰影讓電線有立體感
        path.style.filter = "drop-shadow(2px 5px 3px rgba(0,0,0,0.5))";

        svg.appendChild(path);
    });
}

// 清除按鈕
document.getElementById('clear-btn').addEventListener('click', () => {
    document.getElementById('paper-strip').value = '';
});
document.getElementById('reset-pos-btn').addEventListener('click', () => {
    currentRotors.forEach(r => r.pos = 0);
    updateRotorDisplay();
});

// Info Modal 邏輯
const INFO_CONTENT = {
    'rotor': { title: '轉子 (Walzen)', text: '1. 轉子選擇 (例如 I, II, III...)：\n這代表物理上選擇了哪一顆轉子放進去，每一顆轉子內部的「交叉接線」都完全不同。通常有 5 顆不同的轉子，但機器只能放 3 顆。因此在選擇輪子的部分，一共會有 5*4*3=60種可能性。\n\n2.環設定 (Ringstellung，數字 1~26)：\n轉子是由「內部的金屬線圈」與「外部有字母的圓環」拼在一起的。這個數字代表你可以把外部的字母環拔起來，轉動幾個刻度後再卡回去。這會改變內部的電路偏移量，同時也會改變轉子「帶動下一顆轉子轉動」的時機。\n\n3.初始位置 / 轉子視窗 (Grundstellung，字母 A~Z)：\n這是機器蓋上蓋子後，操作員能從小視窗看到的字母。這代表加密開始前，轉子被轉到的初始角度。每次加密一份新電報，操作員都會隨意轉動這三個字母作為起點值。' },
    'lamp': { title: '顯示燈 (Lampenfeld)', text: '電流經過轉子和反射器折返後，最終會回到這裡，點亮對應的燈泡。發亮的字母就是加密（或解密）後的結果。' },
    'keyboard': { title: '鍵盤 (Tastatur)', text: '採用德國 QWERTZ 排列。每按下一個按鍵，就會接通電池，將電流送入機器。恩尼格瑪機沒有數字和空白鍵，數字必須拼寫出來。' },
    'plugboard': { title: '接線板 (Steckerbrett)', text: '位於機器正前方。操作員可以用電纜將兩個字母連接互換（例如 A 與 B 互換），此設計大大的增加了密碼的複雜度。' }
};

function initInfoModals() {
    const modal = document.getElementById('info-modal');
    const closeBtn = document.querySelector('.close-btn');
    const title = document.getElementById('modal-title');
    const text = document.getElementById('modal-text');

    document.querySelectorAll('.info-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            let key = btn.dataset.info;
            title.innerText = INFO_CONTENT[key].title;
            text.innerText = INFO_CONTENT[key].text;
            modal.classList.add('show');
        });
    });

    closeBtn.addEventListener('click', () => modal.classList.remove('show'));
    window.addEventListener('click', (e) => { if(e.target === modal) modal.classList.remove('show'); });
}

function initImageModal() {
    const modal = document.getElementById("image-modal");
    const img = document.getElementById("zoomable-img");
    const modalImg = document.getElementById("enlarged-img");
    const closeBtn = document.querySelector(".img-close-btn");

    if (img && modal) {
        // 點擊原圖打開視窗
        img.addEventListener('click', function() {
            modal.classList.add('show');
            modalImg.src = this.src; 
        });

        // 點擊叉叉關閉
        closeBtn.addEventListener('click', function() {
            modal.classList.remove('show');
        });

        // 點擊黑色背景也能關閉
        modal.addEventListener('click', function(e) {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });
    }
}