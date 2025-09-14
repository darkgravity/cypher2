// =================== TILE SHAPE DATA & CONSTANTS (STANDARDIZED TOKENS) ===================
const O1 = [[50, 100], [22.38576, 100], [0, 77.61424], [0, 50], [0, 22.38576], [22.38576, 0], [50, 0], [77.61424, 0], [100, 22.38576], [100, 50], [100, 77.61424], [77.61424, 100], [50, 100]];
const O2 = [[[0, 100], [0, 60.94756], [0, 39.05244], [0, 0]], [[0, 0], [39.05244, 0], [60.94756, 0], [100, 0]], [[100, 0], [100, 39.05244], [100, 60.94756], [100, 100]], [[100, 100], [60.94756, 100], [39.05244, 100], [0, 100]]];
const T1 = [[100, 50], [100, 62.59489], [95.80081, 75.89838], [85, 97.5], [70, 127.5], [60, 150], [50, 170]];
const A1 = [[0, 100], [0, 44.77153], [44.77153, 0], [100, 0]];
const T2 = [[0, 100], [0, 98.55142], [0, 97.60583], [0, 95.86223], [0, 86.02135], [2.2035, 78.6779], [13.60175, 71.83895], [25, 65], [77.7965, 33.8221], [86.39825, 28.16105], [95, 22.5], [100, 13.97865], [100, 4.13777], [100, 2.45969], [100, 1.47426], [100, 0]];
const T5 = [[100, 100], [100, 94.17794], [100, 83.96495], [100, 77.87644], [100, 62.94977], [73.78861, 44.7559], [47.50002, 44.90245], [30, 45], [8.07535, 44.88432], [0, 52.5], [0, 33.00773], [0, 10], [0, 0], [17.36688, 0], [82.5, 0], [100, 0]];
const A2 = [[100, 100], [100, 44.77153], [55.22847, 0], [0, 0]];
const A3 = [[100, 0], [100, 55.22847], [55.22847, 100], [0, 100]];
const A4 = [[0, 0], [0, 55.22847], [44.77153, 100], [100, 100]];
const S1 = [[50, 0], [50, 33.33333], [50, 66.66666], [50, 100]];
const S2 = [[100, 50], [66.66666, 50], [33.33333, 50], [0, 50]];
const S3 = [[100, 0], [66.66666, 33.33333], [33.33333, 66.66666], [0, 100]];
const S4 = [[0, 0], [33.33333, 33.33333], [66.66666, 66.66666], [100, 100]];
const C1 = [[0, 66.7], [12.5, 35], [51.80916, 0], [100, 0]];
const C2 = [[100, 66.7], [87.5, 35], [48.19084, 0], [0, 0]];
const C3 = [[100, 33.3], [87.5, 65], [48.19084, 100], [0, 100]];
const C4 = [[0, 33.3], [12.50001, 65], [51.80916, 100], [100, 100]];
const AA = [[[50, 0], [30.47378, 39.05244], [19.52622, 60.94756], [0, 100]], [[50, 0], [69.52622, 39.05244], [80.47378, 60.94756], [100, 100]], [[15, 70], [42.33671, 70], [57.66329, 70], [85, 70]]];

const raw_data = { O1, O2, A1, A2, A3, A4, S1, S2, S3, S4,  C1, C2, C3, C4, T1, T2, T5, AA };
const tileShapesData = { O1, O2, A1, A2, A3, A4, S1, S2, S3, S4,  C1, C2, C3, C4, T1, T2 , AA};

// Corner originals for mode switching
const A1_ORIG = JSON.parse(JSON.stringify(raw_data.A1));
const A2_ORIG = JSON.parse(JSON.stringify(raw_data.A2));
const A3_ORIG = JSON.parse(JSON.stringify(raw_data.A3));
const A4_ORIG = JSON.parse(JSON.stringify(raw_data.A4));
const C1_ORIG = JSON.parse(JSON.stringify(raw_data.C1));
const C2_ORIG = JSON.parse(JSON.stringify(raw_data.C2));
const C3_ORIG = JSON.parse(JSON.stringify(raw_data.C3));
const C4_ORIG = JSON.parse(JSON.stringify(raw_data.C4));

// Dynamic corners for bevel mode
let A1_DYNAMIC = JSON.parse(JSON.stringify(raw_data.A1));
let A2_DYNAMIC = JSON.parse(JSON.stringify(raw_data.A2));
let A3_DYNAMIC = JSON.parse(JSON.stringify(raw_data.A3));
let A4_DYNAMIC = JSON.parse(JSON.stringify(raw_data.A4));
let C1_DYNAMIC = JSON.parse(JSON.stringify(raw_data.C1));
let C2_DYNAMIC = JSON.parse(JSON.stringify(raw_data.C2));
let C3_DYNAMIC = JSON.parse(JSON.stringify(raw_data.C3));
let C4_DYNAMIC = JSON.parse(JSON.stringify(raw_data.C4));

// Tile type preview configurations - SUPPORTS MULTIPLE TOKENS & FOLDERS
const defaultTileTypeBg = ["O20100000"];

// Helper function to define bounds and defaults for tile types
function setBounds(tokens, mode = "LTRB", defaultValue = 0) {
  return {
    tokens: tokens,
    mode: mode,  // "LTRB", "LR", "TB", "RAD"
    defaultValue: defaultValue,
    visibleSliders: {
      left: mode === "LTRB" || mode === "LR",
      right: mode === "LTRB" || mode === "LR", 
      top: mode === "LTRB" || mode === "TB",
      bottom: mode === "LTRB" || mode === "TB" || mode === "RAD"
    }
  };
}

// Tile type configurations with bounds
const tileTypeBg1  = setBounds(["O20100000"], "LTRB", 0);
const tileTypeBg2  = setBounds(["O202K0000"], "RAD", 10);
const tileTypeBg3  = setBounds(["O203K0000"], "RAD", 10);
const tileTypeBg4  = setBounds(["O204K0000"], "RAD", 10);
const tileTypeBg5  = setBounds(["O205K0000"], "RAD", 10);
const tileTypeBg6  = setBounds(["S10600000"], "TB", 0);
const tileTypeBg7  = setBounds(["S10700000"], "TB", 0);
const tileTypeBg8  = setBounds(["S10800000"], "TB", 0);
const tileTypeBg9  = setBounds(["S10900000"], "TB", 0);
const tileTypeBg10 = setBounds(["S11000000"], "TB", 0);
const tileTypeBg11 = setBounds(["S11100000"], "TB", 0);
const tileTypeBg12 = setBounds(["S11200000"], "TB", 0);
const tileTypeBg13 = setBounds(["S11300000"], "TB", 0);
const tileTypeBg14 = setBounds(["S11400000"], "TB", 0);
const tileTypeBg15 = setBounds(["S21500000"], "LR", 0);
const tileTypeBg16 = setBounds(["S21600000"], "LR", 0);
const tileTypeBg17 = setBounds(["S21700000"], "LR", 0);
const tileTypeBg18 = setBounds(["S21800000"], "LR", 0);
const tileTypeBg19 = setBounds(["S21900000"], "LR", 0);
const tileTypeBg20 = setBounds(["S22000000"], "LR", 0);
const tileTypeBg21 = setBounds(["S22100000"], "LR", 0);
const tileTypeBg22 = setBounds(["S22200000"], "LR", 0);
const tileTypeBg23 = setBounds(["S22300000"], "LR", 0);
const tileTypeBg24 = setBounds(["O22450000"], "RAD", 0);
const tileTypeBg25 = setBounds(["O22550000"], "RAD", 0);
const tileTypeBg26 = setBounds(["O22650000"], "RAD", 0);
const tileTypeBg27 = setBounds(["O22750000"], "RAD", 0);
const tileTypeBg28 = setBounds(["O22850000"], "RAD", 0);
const tileTypeBg29 = setBounds(["O22950000"], "RAD", 0);
const tileTypeBg30 = setBounds(["O23050000"], "LTRB", 0);
const tileTypeBg31 = setBounds(["O23150000"], "RAD", 4);
const tileTypeBg32 = setBounds(["O23240000"], "RAD", 4);
const tileTypeBg33 = setBounds(["O23340000"], "RAD", 4);
const tileTypeBg34 = setBounds(["O23440000"], "RAD", 4);
const tileTypeBg35 = setBounds(["O23540000"], "RAD", 4);
const tileTypeBg36 = setBounds(["O23622220"], "LTRB", 4);
const tileTypeBg37 = setBounds(["O23700000"], "LTRB", 4);
const tileTypeBg38 = setBounds(["O23800000"], "LTRB", 4);
const tileTypeBg39 = setBounds(["O23900000"], "LTRB", 2);
const tileTypeBg40 = setBounds(["O24000000"], "LTRB", 2);
const tileTypeBg41 = setBounds(["O24103000"], "LTRB", 4);
const tileTypeBg42 = setBounds(["O24230000"], "LTRB", 4);
const tileTypeBg43 = setBounds(["O24303000"], "LTRB", 2);
const tileTypeBg44 = setBounds(["O24430000"], "LTRB", 2);


// Example of complex multi-token preview with folders
// You can customize any tile type preview with multiple tokens:
// const tileTypeBg24 = setBounds(["X10100400","X20100060","A20320401","A30420401"], "LTRB", 0);

function getBgConfigForType(tileType) {
  const bg = {
    '01': tileTypeBg1, '02': tileTypeBg2, '03': tileTypeBg3, '04': tileTypeBg4, '05': tileTypeBg5,
    '06': tileTypeBg6, '07': tileTypeBg7, '08': tileTypeBg8, '09': tileTypeBg9, '10': tileTypeBg10,
    '11': tileTypeBg11, '12': tileTypeBg12, '13': tileTypeBg13, '14': tileTypeBg14, '15': tileTypeBg15,
    '16': tileTypeBg16, '17': tileTypeBg17, '18': tileTypeBg18, '19': tileTypeBg19, '20': tileTypeBg20,
    '21': tileTypeBg21, '22': tileTypeBg22, '23': tileTypeBg23, '24': tileTypeBg24, '25': tileTypeBg25,
    '26': tileTypeBg26, '27': tileTypeBg27, '28': tileTypeBg28, '29': tileTypeBg29, '30': tileTypeBg30,
    '31': tileTypeBg31, '32': tileTypeBg32, '33': tileTypeBg33, '34': tileTypeBg34, '35': tileTypeBg35,
    '36': tileTypeBg36, '37': tileTypeBg37, '38': tileTypeBg38, '39': tileTypeBg39, '40': tileTypeBg40,
    '41': tileTypeBg41, '42': tileTypeBg42, '43': tileTypeBg43, '44': tileTypeBg44
  };
  return bg[tileType] || defaultTileTypeBg;
}

const tileTypes = ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20', '21', '22', '23', '24', '25', '26', '27', '28', '29', '30', '31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41', '42', '43', '44'];

// Constants
const K = 0.346522508589879;  // Bezier control point constant
const STORAGE_KEY = 'bezierTileCharacters_v6_standardized';