let parser = require("ipa-parser").parser;

window.onload = () => {
  this.inputNode = document.querySelector('#input');
  this.typeNode = document.querySelector('#transcription-type');
  this.unitsNode = document.querySelector('#units');

  document.querySelector('#btn').onclick =
    () => {
      let ipa = this.inputNode.value;
      try {
        let result = parser.parse(ipa);

        let units = "";
        result.units.forEach(unit => units += "<li>" + JSON.stringify(unit) + "</li>");

        this.typeNode.textContent = result.type;
        this.unitsNode.innerHTML = units;
      } catch (ex) {
        console.error(ex);
        this.typeNode.textContent = "Error";
        this.unitsNode.innerHTML = ex.message;
      }
    };
}