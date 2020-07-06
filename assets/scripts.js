async function verifySignature(opts) {
    // Init
    const elRes = document.body.querySelector("#result");
    const elResContent = document.body.querySelector("#resultContent");
    let keyData, feedback, signature, verified, valid;

    // Reset feedback
    elRes.innerHTML = "";
    elRes.classList.remove('green');
    elRes.classList.remove('red');
    elResContent.innerHTML = "";

    try {
        // Get key data
        keyData = await fetchKeys(opts);

        // Handle missing signature
        if (opts.signature == null) { throw("No signature was provided."); }

        // Try two different methods of signature reading
        let readError = null;
        try {
            signature = await openpgp.message.readArmored(opts.signature);
        } catch(e) {
            readError = e;
        }
        try {
            signature = await openpgp.cleartext.readArmored(opts.signature);
        } catch(e) {
            readError = e;
        }
        if (signature == null) { throw(readError) };

        // Verify the signature
        verified = await openpgp.verify({
            message: signature,
            publicKeys: keyData.publicKey
        });
        valid = verified.signatures[0].valid;
    } catch (e) {
        console.error(e);
        elRes.innerHTML = e;
        elRes.classList.remove('green');
        elRes.classList.add('red');
        return;
    }

    // Init feedback to empty string
    feedback = '';

    // If content was extracted from signature
    if (keyData.sigContent) {
        elResContent.innerHTML = "<strong>Signature content:</strong><br><span style=\"white-space: pre-line\">"+sigContent+"</span>";
    }

    // Provide different feedback depending on key input mode
    if (opts.mode == "signature" && keyData.sigUserId) {
        if (valid) {
            feedback += "The message was signed by the userId extracted from the signature.<br>";
            feedback += 'UserId: '+keyData.sigUserId+'<br>';
            feedback += "Fingerprint: "+keyData.fingerprint+"<br>";
            elRes.classList.remove('red');
            elRes.classList.add('green');
        } else {
            feedback += "The message's signature COULD NOT BE verified using the userId extracted from the signature.<br>";
            feedback += 'UserId: '+keyData.sigUserId+'<br>';
            elRes.classList.remove('green');
            elRes.classList.add('red');
        }
    } else if (opts.mode == "signature" && keyData.sigKeyId) {
        if (valid) {
            feedback += "The message was signed by the keyId extracted from the signature.<br>";
            feedback += 'KeyID: '+keyData.sigKeyId+'<br>';
            feedback += "Fingerprint: "+keyData.fingerprint+"<br><br>";
            feedback += "!!! You should manually verify the fingerprint to confirm the signer's identity !!!";
            elRes.classList.remove('red');
            elRes.classList.add('green');
        } else {
            feedback += "The message's signature COULD NOT BE verified using the keyId extracted from the signature.<br>";
            feedback += 'KeyID: '+keyData.sigKeyId+'<br>';
            elRes.classList.remove('green');
            elRes.classList.add('red');
        }
    } else {
        if (valid) {
            feedback += "The message was signed by the provided key ("+opts.mode+").<br>";
            feedback += "Fingerprint: "+keyData.fingerprint+"<br>";
            elRes.classList.remove('red');
            elRes.classList.add('green');
        } else {
            feedback += "The message's signature COULD NOT BE verified using the provided key ("+opts.mode+").<br>";
            elRes.classList.remove('green');
            elRes.classList.add('red');
        }
    }

    // Display feedback
    elRes.innerHTML = feedback;
};

async function encryptMessage(opts) {
    // Init
    const elEnc = document.body.querySelector("#message");
    const elRes = document.body.querySelector("#result");
    const elBtn = document.body.querySelector("[name='submit']");
    let keyData, feedback, message, encrypted;

    // Reset feedback
    elRes.innerHTML = "";
    elRes.classList.remove('green');
    elRes.classList.remove('red');

    try {
        // Get key data
        keyData = await fetchKeys(opts);

        // Handle missing message
        if (opts.message == null) {
            throw("No message was provided.");
        }

        // Encrypt the message
        encrypted = await openpgp.encrypt({
            message: openpgp.message.fromText(opts.message),
            publicKeys: keyData.publicKey
        });
    } catch (e) {
        console.error(e);
        elRes.innerHTML = e;
        elRes.classList.remove('green');
        elRes.classList.add('red');
        return;
    }

    // Display encrypted data
    elEnc.value = encrypted.data;
    elEnc.toggleAttribute("readonly");
    elBtn.setAttribute("disabled", "true");
};

async function verifyProofs(opts) {
    // Init
    const elRes = document.body.querySelector("#result");
    let keyData, feedback = "", message, encrypted;

    // Reset feedback
    elRes.innerHTML = "";
    elRes.classList.remove('green');
    elRes.classList.remove('red');

    try {
        // Get key data
        keyData = await fetchKeys(opts);
    } catch (e) {
        console.error(e);
        elRes.innerHTML = e;
        elRes.classList.remove('green');
        elRes.classList.add('red');
        return;
    }

    // Display feedback
    elRes.innerHTML = "Verifying proofs&hellip;";

    let notation, isVerified, verifications = [];
    for (var i = 0; i < keyData.notations.length; i++) {
        notation = keyData.notations[i];
        if (notation[0] != "proof@metacode.biz") { continue; }
        verifications.push(await verifyProof(notation[1], keyData.fingerprint));
    }

    // One-line sorting function (order verifications by type)
    verifications = verifications.sort((a,b) => (a.type > b.type) ? 1 : ((b.type > a.type) ? -1 : 0));

    // Generate feedback
    feedback += `<p>`;
    for (var i = 0; i < verifications.length; i++) {
        if (verifications[i].type == "null") { continue; }
        feedback += `${verifications[i].type}: `;
        feedback += `<a class="proofDisplay" href="${verifications[i].url}">${verifications[i].display}</a>`;
        if (verifications[i].isVerified) {
            feedback += `<a class="proofUrl proofUrl--verified" href="${verifications[i].proofUrl}">verified &#10004;</a>`;
        } else {
            feedback += `<a class="proofUrl" href="${verifications[i].proofUrl}">proof</a>`;
        }
        feedback += `<br>`;
    }
    feedback += `</p>`;

    // Display feedback
    elRes.innerHTML = feedback;
}

async function displayProfile(opts) {
    let keyData, keyLink, feedback = "", notation, isVerified, verifications = [];
    try {
        keyData = await fetchKeys(opts);
    } catch (e) {
        feedback += `<p>There was a problem fetching the keys.</p>`;
        feedback += `<code>${e}</code>`;
        document.body.querySelector('#profileData').innerHTML = feedback;
        document.body.querySelector('#profileName').innerHTML = "Could not load profile";
        return;
    }
    let userData = keyData.user.user.userId;

    // Determine WKD or HKP link
    switch (opts.mode) {
        case "wkd":
            const [, localPart, domain] = /(.*)@(.*)/.exec(opts.input);
            const localEncoded = await computeWKDLocalPart(localPart.toLowerCase());
            const urlAdvanced = `https://openpgpkey.${domain}/.well-known/openpgpkey/${domain}/hu/${localEncoded}`;
            const urlDirect = `https://${domain}/.well-known/openpgpkey/hu/${localEncoded}`;

            try {
                keyLink = await fetch(urlAdvanced).then(function(response) {
                    if (response.status === 200) {
                        return urlAdvanced;
                    }
                });
            } catch (e) {
                console.warn(e);
            }
            if (!keyLink) {
                try {
                    keyLink = await fetch(urlDirect).then(function(response) {
                        if (response.status === 200) {
                            return urlDirect;
                        }
                    });
                } catch (e) {
                    console.warn(e);
                }
            }
            if (!keyLink) {
                keyLink = `https://keys.openpgp.org/pks/lookup?op=get&options=mr&search=0x${keyData.fingerprint}`;
            }
            break;

        case "hkp":
            keyLink = `https://keys.openpgp.org/pks/lookup?op=get&options=mr&search=0x${keyData.fingerprint}`;
            break;

        case "keybase":
            keyLink = opts.keyLink;
            break;
    }

    // Fill in various data
    document.body.querySelector('#profileName').innerHTML = userData.name;
    document.body.querySelector('#profileAvatar').style = "";
    document.body.querySelector('#profileAvatar').src = `https://www.gravatar.com/avatar/${SparkMD5.hash(userData.email)}?s=128&d=mm`;
    document.title = `${userData.name} - Keyoxide`;

    // Generate feedback
    feedback += `<div class="profileDataItem profileDataItem--separator profileDataItem--noLabel">`;
    feedback += `<div class="profileDataItem__label"></div>`;
    feedback += `<div class="profileDataItem__value">general information</div>`;
    feedback += `</div>`;
    for (var i = 0; i < keyData.publicKey.users.length; i++) {
        if (keyData.publicKey.users[i].userId && 'email' in keyData.publicKey.users[i].userId && keyData.publicKey.users[i].userId.email) {
            feedback += `<div class="profileDataItem">`;
            feedback += `<div class="profileDataItem__label">email</div>`;
            feedback += `<div class="profileDataItem__value"><a href="mailto:${keyData.publicKey.users[i].userId.email}">${keyData.publicKey.users[i].userId.email}</a></div>`;
            feedback += `</div>`;
        }
    }
    feedback += `<div class="profileDataItem">`;
    feedback += `<div class="profileDataItem__label">fingerprint</div>`;
    feedback += `<div class="profileDataItem__value"><a href="${keyLink}">${keyData.fingerprint}</a></div>`;
    feedback += `</div>`;

    if (opts.mode == "hkp") {
        feedback += `<div class="profileDataItem">`;
        feedback += `<div class="profileDataItem__label">qrcode</div>`;
        feedback += `<div class="profileDataItem__value"><a href="/util/qr/${keyData.fingerprint}">fingerprint</a></div>`;
        feedback += `</div>`;
    }

    if (keyData.notations.length > 0) {
        feedback += `<div class="profileDataItem profileDataItem--separator profileDataItem--noLabel">`;
        feedback += `<div class="profileDataItem__label"></div>`;
        feedback += `<div class="profileDataItem__value">proofs</div>`;
        feedback += `</div>`;

        feedback += `<div id="profileProofs">`;
        feedback += `<div class="profileDataItem  profileDataItem--noLabel">`;
        feedback += `<div class="profileDataItem__label"></div>`;
        feedback += `<div class="profileDataItem__value">Verifying proofs&hellip;</div>`;
        feedback += `</div>`;
        feedback += `</div>`;
    }

    feedback += `<div class="profileDataItem profileDataItem--separator profileDataItem--noLabel">`;
    feedback += `<div class="profileDataItem__label"></div>`;
    feedback += `<div class="profileDataItem__value">actions</div>`;
    feedback += `</div>`;
    feedback += `<div class="profileDataItem profileDataItem--noLabel">`;
    feedback += `<div class="profileDataItem__label"></div>`;
    feedback += `<div class="profileDataItem__value"><a href="/verify/${opts.mode}/${opts.input.replace(".", "_")}">verify signature</a></div>`;
    feedback += `</div>`;
    feedback += `<div class="profileDataItem profileDataItem--noLabel">`;
    feedback += `<div class="profileDataItem__label"></div>`;
    feedback += `<div class="profileDataItem__value"><a href="/encrypt/${opts.mode}/${opts.input.replace(".", "_")}">encrypt message</a></div>`;
    feedback += `</div>`;

    // Display feedback
    document.body.querySelector('#profileData').innerHTML = feedback;

    // Exit if no notations are available
    if (keyData.notations.length == 0) {
        return;
    }

    // Verify identity proofs
    for (var i = 0; i < keyData.notations.length; i++) {
        notation = keyData.notations[i];
        if (notation[0] != "proof@metacode.biz") { continue; }
        verifications.push(await verifyProof(notation[1], keyData.fingerprint));
    }

    // One-line sorting function (order verifications by type)
    verifications = verifications.sort((a,b) => (a.type > b.type) ? 1 : ((b.type > a.type) ? -1 : 0));

    feedback = "";
    if (verifications.length > 0) {
        for (var i = 0; i < verifications.length; i++) {
            if (!verifications[i].type) { continue; }
            feedback += `<div class="profileDataItem">`;
            feedback += `<div class="profileDataItem__label">${verifications[i].type}</div>`;
            feedback += `<div class="profileDataItem__value">`;
            feedback += `<a class="proofDisplay" href="${verifications[i].url}">${verifications[i].display}</a>`;
            if (verifications[i].isVerified) {
                feedback += `<a class="proofUrl proofUrl--verified" href="${verifications[i].proofUrl}">verified &#10004;</a>`;
            } else {
                feedback += `<a class="proofUrl" href="${verifications[i].proofUrl}">proof</a>`;
            }
            feedback += `</div>`;
            feedback += `</div>`;
        }
    } else {
        feedback += `<div class="profileDataItem  profileDataItem--noLabel">`;
        feedback += `<div class="profileDataItem__label"></div>`;
        feedback += `<div class="profileDataItem__value">No proofs found in key</div>`;
        feedback += `</div>`;
    }

    // Display feedback
    document.body.querySelector('#profileProofs').innerHTML = feedback;
}

async function verifyProof(url, fingerprint) {
    // Init
    let reVerify, match, output = {url: url, type: null, proofUrl: url, proofUrlFetch: null, isVerified: false, display: null};

    // DNS
    if (/^dns:/.test(url)) {
        output.type = "domain";
        output.display = url.replace(/dns:/, '').replace(/\?type=TXT/, '');
        output.proofUrl = `https://dns.shivering-isles.com/dns-query?name=${output.display}&type=TXT`;
        output.proofUrlFetch = output.proofUrl;
        output.url = `https://${output.display}`;

        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            reVerify = new RegExp(`openpgp4fpr:${fingerprint}`, 'i');
            json.Answer.forEach((item, i) => {
                if (reVerify.test(item.data)) {
                    output.isVerified = true;
                }
            });
        } catch (e) {
        } finally {
            return output;
        }
    }
    // Twitter
    if (/^https:\/\/twitter.com/.test(url)) {
        output.type = "twitter";
        match = url.match(/https:\/\/twitter\.com\/(.*)\/status\/(.*)/);
        output.display = `@${match[1]}`;
        output.url = `https://twitter.com/${match[1]}`;
        output.proofUrlFetch = `/server/verifyTweet.php?id=${match[2]}&fp=${fingerprint}`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            output.isVerified = json.verified;
        } catch (e) {
        } finally {
            return output;
        }
    }
    // HN
    if (/^https:\/\/news.ycombinator.com/.test(url)) {
        output.type = "hn";
        match = url.match(/https:\/\/news.ycombinator.com\/user\?id=(.*)/);
        output.display = match[1];
        output.proofUrlFetch = `https://hacker-news.firebaseio.com/v0/user/${match[1]}.json`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            reVerify = new RegExp(`openpgp4fpr:${fingerprint}`, 'i');
            if (reVerify.test(json.about)) {
                output.isVerified = true;
            }
        } catch (e) {
        } finally {
            return output;
        }
    }
    // Reddit
    if (/^https:\/\/www.reddit.com\/user/.test(url)) {
        output.type = "reddit";
        match = url.match(/https:\/\/www.reddit.com\/user\/(.*)\/comments\/(.*)\/(.*)\//);
        output.display = match[1];
        output.url = `https://www.reddit.com/user/${match[1]}`;
        output.proofUrlFetch = `/server/verifyReddit.php?user=${match[1]}&comment=${match[2]}&fp=${fingerprint}`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            output.isVerified = json.verified;
        } catch (e) {
        } finally {
            return output;
        }
    }
    // Github
    if (/^https:\/\/gist.github.com/.test(url)) {
        output.type = "github";
        match = url.match(/https:\/\/gist.github.com\/(.*)\/(.*)/);
        output.display = match[1];
        output.url = `https://github.com/${match[1]}`;
        output.proofUrlFetch = `https://api.github.com/gists/${match[2]}`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            reVerify = new RegExp(`[Verifying my OpenPGP key: openpgp4fpr:${fingerprint}]`, 'i');
            if (reVerify.test(json.files["openpgp.md"].content)) {
                output.isVerified = true;
            }
        } catch (e) {
        } finally {
            return output;
        }
    }
    // Lobsters
    if (/^https:\/\/lobste.rs/.test(url)) {
        output.type = "lobsters";
        match = url.match(/https:\/\/lobste.rs\/u\/(.*)/);
        output.display = match[1];
        output.proofUrlFetch = `/server/verifyLobsters.php?user=${match[1]}&fp=${fingerprint}`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            output.isVerified = json.verified;
        } catch (e) {
        } finally {
            return output;
        }
    }
    // XMPP
    if (/^xmpp:/.test(url)) {
        output.type = "xmpp";
        match = url.match(/xmpp:(.*)@(.*)/);
        output.display = `${match[1]}@${match[2]}`;
    }
    // Catchall
    // Mastodon
    try {
        response = await fetch(url, {
            headers: {
                Accept: 'application/json'
            },
            credentials: 'omit'
        });
        if (!response.ok) {
            throw new Error('Response failed: ' + response.status);
        }
        json = await response.json();
        if ('attachment' in json) {
            match = url.match(/https:\/\/(.*)\/@(.*)/);
            json.attachment.forEach((item, i) => {
                if (item.value.toUpperCase() === fingerprint.toUpperCase()) {
                    output.type = "mastodon";
                    output.display = `@${match[2]}@${[match[1]]}`;
                    output.proofUrlFetch = json.url;
                    output.isVerified = true;
                }
            });
        }
        return output;
    } catch (e) {
        console.warn(e);
    }
    // Discourse
    try {
        match = url.match(/https:\/\/(.*)\/u\/(.*)/);
        output.proofUrlFetch = `/server/verifyDiscourse.php?url=${url}&fp=${fingerprint}`;
        try {
            response = await fetch(output.proofUrlFetch, {
                headers: {
                    Accept: 'application/json'
                },
                credentials: 'omit'
            });
            if (!response.ok) {
                throw new Error('Response failed: ' + response.status);
            }
            json = await response.json();
            if (json.isDiscourse) {
                output.type = "discourse";
                output.display = `${json.user}@${match[1]}`;
                output.isVerified = json.verified;
                return output;
            }
        } catch (e) {
            console.warn(e);
        }
    } catch (e) {
        console.warn(e);
    }
    return output;
}

async function fetchKeys(opts) {
    // Init
    let lookupOpts, wkd, hkd, sig, lastPrimarySig;
    let output = {
        publicKey: null,
        user: null,
        notations: null,
        sigKeyId: null,
        sigUserId: null,
        sigContent: null
    };

    // Autodetect mode
    if (opts.mode == "auto") {
        if (/.*@.*\..*/.test(opts.input)) {
            opts.mode = "wkd";
        } else {
            opts.mode = "hkp";
        }
    }

    // Fetch keys depending on the input mode
    switch (opts.mode) {
        case "plaintext":
            output.publicKey = (await openpgp.key.readArmored(opts.input)).keys[0];

            if (!output.publicKey) {
                throw("Error: No public keys could be fetched from the plaintext input.");
            }
            break;

        case "wkd":
            wkd = new openpgp.WKD();
            lookupOpts = {
                email: opts.input
            };
            output.publicKey = (await wkd.lookup(lookupOpts)).keys[0];

            if (!output.publicKey) {
                throw("Error: No public keys could be fetched using WKD.");
            }
            break;

        case "hkp":
            if (!opts.server) {opts.server = "https://keys.openpgp.org/"};
            hkp = new openpgp.HKP(opts.server);
            lookupOpts = {
                query: opts.input
            };
            output.publicKey = await hkp.lookup(lookupOpts);
            output.publicKey = (await openpgp.key.readArmored(output.publicKey)).keys[0];

            if (!output.publicKey) {
                throw("Error: No public keys could be fetched from the HKP server.");
            }
            break;

        case "keybase":
            opts.keyLink = `https://keybase.io/${opts.username}/pgp_keys.asc?fingerprint=${opts.fingerprint}`;
            opts.input = `${opts.username}/${opts.fingerprint}`;
            try {
                opts.plaintext = await fetch(opts.keyLink).then(function(response) {
                    if (response.status === 200) {
                        return response;
                    }
                })
                .then(response => response.text());
            } catch (e) {
                throw(`Error: No public keys could be fetched from the Keybase account (${e}).`);
            }
            output.publicKey = (await openpgp.key.readArmored(opts.plaintext)).keys[0];

            if (!output.publicKey) {
                throw("Error: No public keys could be read from the Keybase account.");
            }
            break;

        case "signature":
            sig = (await openpgp.signature.readArmored(opts.signature));
            if ('compressed' in sig.packets[0]) {
                sig = sig.packets[0];
                output.sigContent = (await openpgp.stream.readToEnd(await sig.packets[1].getText()));
            };
            output.sigUserId = sig.packets[0].signersUserId;
            output.sigKeyId = (await sig.packets[0].issuerKeyId.toHex());

            if (!opts.server) {opts.server = "https://keys.openpgp.org/"};
            hkp = new openpgp.HKP(opts.server);
            lookupOpts = {
                query: output.sigUserId ? output.sigUserId : output.sigKeyId
            };
            output.publicKey = await hkp.lookup(lookupOpts);
            output.publicKey = (await openpgp.key.readArmored(output.publicKey)).keys[0];

            if (!output.publicKey) {
                throw("Error: No public keys could be extracted from the signature.");
            }
            break;
    }

    // Gather more data about the primary key and user
    output.fingerprint = await output.publicKey.primaryKey.getFingerprint();
    output.user = await output.publicKey.getPrimaryUser();
    lastPrimarySig = output.user.selfCertification;
    output.notations = lastPrimarySig.notations || [];

    return output;
}

function encodeZBase32(data) {
    // Source: https://github.com/openpgpjs/openpgpjs/blob/master/src/util.js
    if (data.length === 0) {
        return "";
    }
    const ALPHABET = "ybndrfg8ejkmcpqxot1uwisza345h769";
    const SHIFT = 5;
    const MASK = 31;
    let buffer = data[0];
    let index = 1;
    let bitsLeft = 8;
    let result = '';
    while (bitsLeft > 0 || index < data.length) {
        if (bitsLeft < SHIFT) {
            if (index < data.length) {
                buffer <<= 8;
                buffer |= data[index++] & 0xff;
                bitsLeft += 8;
            } else {
                const pad = SHIFT - bitsLeft;
                buffer <<= pad;
                bitsLeft += pad;
            }
        }
        bitsLeft -= SHIFT;
        result += ALPHABET[MASK & (buffer >> bitsLeft)];
    }
    return result;
}

async function computeWKDLocalPart(message) {
    const encoder = new TextEncoder();
    const data = encoder.encode(message);
    const hash = await crypto.subtle.digest('SHA-1', data);
    return encodeZBase32(new Uint8Array(hash));
}

async function generateProfileURL(data) {
    if (data.input == "") {
        return "Waiting for input...";
    }
    switch (data.source) {
        case "wkd":
            return `https://keyoxide.org/${data.input}`;
            break;
        case "hkp":
            if (/.*@.*\..*/.test(data.input)) {
                return `https://keyoxide.org/hkp/${data.input}`;
            } else {
                return `https://keyoxide.org/${data.input}`;
            }
            break;
        case "keybase":
            const re = /https\:\/\/keybase.io\/(.*)\/pgp_keys\.asc\?fingerprint\=(.*)/;
            if (!re.test(data.input)) {
                return "Incorrect Keybase public key URL.";
            }
            const match = data.input.match(re);
            return `https://keyoxide.org/keybase/${match[1]}/${match[2]}`;
            break;
    }
}

// General purpose
let elFormVerify = document.body.querySelector("#form-verify"),
    elFormEncrypt = document.body.querySelector("#form-encrypt"),
    elFormProofs = document.body.querySelector("#form-proofs"),
    elProfileUid = document.body.querySelector("#profileUid"),
    elProfileMode = document.body.querySelector("#profileMode"),
    elModeSelect = document.body.querySelector("#modeSelect"),
    elUtilWKD = document.body.querySelector("#form-util-wkd"),
    elUtilQR = document.body.querySelector("#form-util-qr"),
    elUtilProfileURL = document.body.querySelector("#form-util-profile-url");

if (elModeSelect) {
    elModeSelect.onchange = function (evt) {
        let elAllModes = document.body.querySelectorAll('.modes');
        elAllModes.forEach(function(el) {
            el.classList.remove('modes--visible');
        });
        document.body.querySelector(`.modes--${elModeSelect.value}`).classList.add('modes--visible');
    }
    elModeSelect.dispatchEvent(new Event("change"));
}

if (elFormVerify) {
    elFormVerify.onsubmit = function (evt) {
        evt.preventDefault();

        let opts = {
            signature: null,
            mode: null,
            input: null,
            server: null,
        };

        opts.signature = document.body.querySelector("#signature").value;
        opts.mode = document.body.querySelector("#modeSelect").value;

        switch (opts.mode) {
            default:
            case "auto":
                opts.input = document.body.querySelector("#auto_input").value;
                break;

            case "wkd":
                opts.input = document.body.querySelector("#wkd_input").value;
                break;

            case "hkp":
                opts.input = document.body.querySelector("#hkp_input").value;
                opts.server =  document.body.querySelector("#hkp_server").value;
                break;

            case "plaintext":
                opts.input = document.body.querySelector("#plaintext_input").value;
                break;

            case "keybase":
                opts.username = document.body.querySelector("#keybase_username").value;
                opts.fingerprint =  document.body.querySelector("#keybase_fingerprint").value;
                break;
        }

        // If no input was detect
        if (!opts.input && !opts.username) {
            opts.mode = "signature";
        }

        verifySignature(opts);
    };
}

if (elFormEncrypt) {
    elFormEncrypt.onsubmit = function (evt) {
        evt.preventDefault();

        let opts = {
            message: null,
            mode: null,
            input: null,
            server: null,
        };

        opts.message = document.body.querySelector("#message").value;
        opts.mode = document.body.querySelector("#modeSelect").value;

        switch (opts.mode) {
            default:
            case "auto":
                opts.input = document.body.querySelector("#auto_input").value;
                break;

            case "wkd":
                opts.input = document.body.querySelector("#wkd_input").value;
                break;

            case "hkp":
                opts.input = document.body.querySelector("#hkp_input").value;
                opts.server =  document.body.querySelector("#hkp_server").value;
                break;

            case "plaintext":
                opts.input = document.body.querySelector("#plaintext_input").value;
                break;

            case "keybase":
                opts.username = document.body.querySelector("#keybase_username").value;
                opts.fingerprint =  document.body.querySelector("#keybase_fingerprint").value;
                break;
        }

        encryptMessage(opts);
    };
}

if (elFormProofs) {
    elFormProofs.onsubmit = function (evt) {
        evt.preventDefault();

        let opts = {
            mode: null,
            input: null,
            server: null,
        };

        opts.mode = document.body.querySelector("#modeSelect").value;

        switch (opts.mode) {
            default:
            case "auto":
                opts.input = document.body.querySelector("#auto_input").value;
                break;

            case "wkd":
                opts.input = document.body.querySelector("#wkd_input").value;
                break;

            case "hkp":
                opts.input = document.body.querySelector("#hkp_input").value;
                opts.server =  document.body.querySelector("#hkp_server").value;
                break;

            case "plaintext":
                opts.input = document.body.querySelector("#plaintext_input").value;
                break;
        }

        verifyProofs(opts);
    };
}

if (elProfileUid) {
    let match, opts, profileUid = elProfileUid.innerHTML;
    switch (elProfileMode.innerHTML) {
        default:
        case "auto":
            if (/.*@.*/.test(profileUid)) {
                // Match email for wkd
                opts = {
                    input: profileUid,
                    mode: "wkd"
                }
            } else {
                // Match fingerprint for hkp
                opts = {
                    input: profileUid,
                    mode: "hkp"
                }
            }
            break;

        case "hkp":
        case "wkd":
            opts = {
                input: profileUid,
                mode: elProfileMode.innerHTML
            }
            break;

        case "keybase":
            let match = profileUid.match(/(.*)\/(.*)/);
            opts = {
                username: match[1],
                fingerprint: match[2],
                mode: elProfileMode.innerHTML
            }
            break;
    }
    displayProfile(opts);
}

if (elUtilWKD) {
    elUtilWKD.onsubmit = function (evt) {
        evt.preventDefault();
    }

    const elInput = document.body.querySelector("#input");
    const elOutput = document.body.querySelector("#output");

    elInput.addEventListener("input", async function(evt) {
        if (evt.target.value) {
            elOutput.value = await computeWKDLocalPart(evt.target.value);
        } else {
            elOutput.value = "";
        }
    });
}

if (elUtilQR) {
    elUtilQR.onsubmit = function (evt) {
        evt.preventDefault();
    }

    const qrcode = new QRCode("qrcode", {
        text: "",
        width: 256,
        height: 256,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    const elInput = document.body.querySelector("#input");

    elInput.addEventListener("input", async function(evt) {
        if (evt.target.value) {
            qrcode.makeCode(`OPENPGP4FPR:${evt.target.value.toUpperCase()}`);
        } else {
            qrcode.clear();
        }
    });

    elInput.dispatchEvent(new Event("input"));
}

if (elUtilProfileURL) {
    elUtilProfileURL.onsubmit = function (evt) {
        evt.preventDefault();
    }

    const elInput = document.body.querySelector("#input"),
        elSource = document.body.querySelector("#source"),
        elOutput = document.body.querySelector("#output");

    let data = {
        input: elInput.value,
        source: elSource.value
    };

    elInput.addEventListener("input", async function(evt) {
        data = {
            input: elInput.value,
            source: elSource.value
        };
        elOutput.innerText = await generateProfileURL(data);
    });

    elSource.addEventListener("input", async function(evt) {
        data = {
            input: elInput.value,
            source: elSource.value
        };
        elOutput.innerText = await generateProfileURL(data);
    });

    elInput.dispatchEvent(new Event("input"));
}
