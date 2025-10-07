// Base64 编码函数
function encodeBybase64(encodeStr) {
    const keyStr = 'ABCDEFGHIJKLMNOP' + 'QRSTUVWXYZabcdef' + 'ghijklmnopqrstuv' + 'wxyz0123456789+/' + '=';
    let output = '';
    let chr1 = '';
    let chr2 = '';
    let chr3 = '';
    let enc1 = '';
    let enc2 = '';
    let enc3 = '';
    let enc4 = '';
    let i = 0;
    do {
        chr1 = encodeStr.charCodeAt(i++);
        chr2 = encodeStr.charCodeAt(i++);
        chr3 = encodeStr.charCodeAt(i++);
        enc1 = chr1 >> 2;
        enc2 = (chr1 & 3) << 4 | chr2 >> 4;
        enc3 = (chr2 & 15) << 2 | chr3 >> 6;
        enc4 = chr3 & 63;
        if (isNaN(chr2)) {
            enc3 = enc4 = 64;
        } else if (isNaN(chr3)) {
            enc4 = 64;
        }
        output = output + keyStr.charAt(enc1) + keyStr.charAt(enc2) + keyStr.charAt(enc3) + keyStr.charAt(enc4);
        chr1 = chr2 = chr3 = '';
        enc1 = enc2 = enc3 = enc4 = '';
    } while (i < encodeStr.length);

    return output;
}

// 加密密码函数
function encryptPassword(password) {
    const type = parseInt(3 * Math.random());
    let randompw = password + "_msdp_" + Math.random() + "_msdp_type=" + type;

    if (type === 1) {
        randompw = Math.random() + "_msdp_" + password + "_msdp_type=" + type;
    } else if (type === 2) {
        randompw = Math.random() + "_msdp_type=" + type + "_msdp_" + password;
    }

    return encodeBybase64(randompw);
}

export {
    encodeBybase64,
    encryptPassword
};