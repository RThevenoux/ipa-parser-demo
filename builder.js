let fs = require("fs");

let dependencies = require('./package.json').dependencies;
let html = fs.readFileSync(__dirname + '/src/index.html', "utf8");
let version = dependencies["ipa-parser"];

let final = html.replace("#version#", version);

fs.writeFileSync(__dirname + '/docs/index.html', final, "utf8");