module.exports = {
    upgrade: true,
    reject: [
        // Block package upgrades that moved to ESM
        'gettext-parser',

        'eslint-config-prettier'
    ]
};
