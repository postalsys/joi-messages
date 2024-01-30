'use strict';

const gettextParser = require('gettext-parser');
const fs = require('fs');
const Path = require('path');

const messages = async () => {
    const result = {};

    const jsonContent = await fs.promises.readFile(Path.join(__dirname, 'translations', 'translations.json'), 'utf-8');
    const translationList = JSON.parse(jsonContent);
    for (let code of Object.keys(translationList)) {
        let fileContents = await fs.promises.readFile(Path.join(__dirname, 'translations', translationList[code]));
        let translations = gettextParser.po.parse(fileContents);

        let messages = {};

        for (let key of Object.keys(translations.translations[''])) {
            let obj = translations.translations[''][key];
            if (!code || !obj?.comments?.reference) {
                continue;
            }
            messages[obj.comments.reference] = obj.msgstr[0] || key;
        }

        if (code.indexOf('_') >= 0) {
            result[code.split('_').shift()] = messages;
        } else {
            result[code] = messages;
        }
    }

    return result;
};

module.exports.messages = messages;
