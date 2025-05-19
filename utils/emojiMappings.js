/**
 * Emoticon to speech text mappings
 * Used to convert text emoticons/emoji to readable text
 */

// Vietnamese emoticon mappings
const vietnameseEmoticons = {
  ":(": "buồn",
  ":(((": "buồn dài",
  ":((": "buồn",
  "=((": "buồn",
  "=(((": "buồn dài",
  "=(": "buồn",
  ":))": "cười",
  ":)))": "cười to",
  "=)": "cười",
  ":v": "cười đểu",
  ":3": "mặt mèo",
  ":'(": "khóc",
  ":'))": "vừa cười vừa khóc",
  "-_-": "chán",
  "=))": "cười lăn",
  "=)))": "cười lăn dài",  "T_T": "khóc hu hu",
  "@@": "hoả mắt",
  ":|": "đơ",
  ":P": "lè lưỡi",
  "^_^": "cười vui",
  "^^": "cười",
  "o_O": "ngạc nhiên",
  ":x": "hôn",
  ">.<": "đau",
  "><": "ngại",
  ":D": "haha",
  "XD": "cười xỉu",
  ":O": "ngạc nhiên",
  ":o": "ngạc nhiên",
  ";)": "nháy mắt",
  ";-)": "nháy mắt",
  ":*": "thơm",
  ":-))": "cười",
  ":-(": "buồn",
  ":-D": "cười lớn",
  "^-^": "cười dịu"
};

// English emoticon mappings (can be used as fallback or for other languages)
const englishEmoticons = {
  ":(": "sad face",
  ":)": "smile",
  ":D": "big smile",
  ":v": "silly face",
  ":3": "cat face",
  ":'(": "crying face",
  "-_-": "annoyed face",
  "=))": "rolling laugh face",
  "T_T": "crying face",
  "@@": "dizzy face",
  ":|": "neutral face",
  ":P": "tongue out",
  "^_^": "happy face",
  "o_O": "surprised face",
  ":x": "kiss face",
  ">.<": "pain face",
  "><": "awkward face",
  "XD": "laughing face"
};

module.exports = {
  vietnameseEmoticons,
  englishEmoticons
};
