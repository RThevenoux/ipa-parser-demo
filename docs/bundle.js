(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const Voicing = require("./voicing");
const Place = require("./place");
const IpaSyntaxtError = require("../error/ipa-syntax-error");

function _computeAffricateVoicing(first, second) {
  // General case
  if (first.isVoiced() == second.isVoiced()) {
    return Voicing.merge(first.voicing, second.voicing);
  }

  // Ad-hoc case for 'ʡ͡ʕ' & 'ʡ͡ʢ'
  if (first.place == "epiglottal" && first.isVoiced() == false) {
    if (second.place == "pharyngeal" || second.place == "epiglottal") {
      return second.voicing.build();
    }
  }

  // Invalid voicing combination
  throw new IpaSyntaxtError("Invalid voicing for affricate");
}

function _computeTrilledAffricateVoicing(first, second) {
  if (first.isVoiced() == second.isVoiced()) {
    return Voicing.merge(first.voicing, second.voicing);
  }
  throw new IpaSyntaxtError("Invalid voicing for trilled affricate");
}

function _computeAffricatePlace(first, second) {
  // General case
  if (second.place == first.place) return second.place;

  // Ad-hoc case
  switch (first.place) {
    // Specific case for 't' + Coronal
    case "alveolar": if (Place.isCoronal(second.place)) return second.place; break;
    // Specific case for 'ʡ' + Pharyngeal
    case "epiglottal": if (second.place == "pharyngeal") return second.place; break;
    // no default. Other case will throw Error
  }

  throw new IpaSyntaxtError("Invalid affricate places: '" + first.place + "' + '" + second.place + "'");
}

function _computeTrilledAffricatePlace(first, second) {
  if (second.place == first.place) return second.place;
  throw new IpaSyntaxtError("Invalid trilled affricate places: '" + first.place + "' + '" + second.place + "'");
}

module.exports = {
  computeAffricateVoicing: _computeAffricateVoicing,
  computeTrilledAffricateVoicing: _computeTrilledAffricateVoicing,
  computeAffricatePlace: _computeAffricatePlace,
  computeTrilledAffricatePlace: _computeTrilledAffricatePlace
}
},{"../error/ipa-syntax-error":15,"./place":5,"./voicing":10}],2:[function(require,module,exports){
const Voicing = require("./voicing");
const Manner = require("./manner");
const IpaSyntaxtError = require("../error/ipa-syntax-error");
const IpaInternError = require("../error/ipa-internal-error");

module.exports = class Articulation {
  constructor(consonant, placeIndex) {
    this.place = consonant.places[placeIndex];
    this.lateral = consonant.lateral;
    this.nasal = consonant.nasal;
    this.manner = consonant.manner;
    this.voicing = new Voicing(consonant.voiced);
    this.coronalType = "unspecified";
  }

  updatePhonation(label) {
    this.voicing.addDiacritic(label);
  }

  updateArticulation(label) {
    switch (label) {
      case "Advanced": this._advance(); break;
      case "Retracted": this._retracte(); break;
      case "Raised": this._raise(); break;
      case "Lowered": this._lower(); break;
      case "Dental": this._dental(); break;
      case "Linguolabial": this._lingolabial(); break;
      case "Apical": this._apical(); break;
      case "Laminal": this._laminal(); break;
      case "Centralized": /*err*/; break;
      case "Mid-centralized": /*err*/; break;
      default: throw new IpaInternError("Unsupported articulation label: '" + label + "'");
    };
  }

  nasalized() {
    this.nasal = true;
  }

  // TODO advance/retracte
  // see https://en.wikipedia.org/wiki/Relative_articulation#Advanced_and_retracted
  // https://en.wikipedia.org/wiki/Bilabial_flap
  _advance() {
  }
  _retracte() {
  }

  _lower() {
    this.manner = Manner.lower(this.manner);
  }

  _raise() {
    this.manner = Manner.raise(this.manner);
  }

  _dental() {
    switch (this.place) {
      case "alveolar": this.place = "dental"; break;
      case "bilabial": this.place = "labiodental"; break;
      default: throw new IpaSyntaxtError("'dental' diacritic on invalid place: '" + this.place + "'");
    }
  }

  _lingolabial() {
    this.place = "linguolabial";
  }

  _apical() {
    this.coronalType = "apical";

    if (this.place == "bilabial") {
      this.place = "linguolabial";
    }
  }

  _laminal() {
    this.coronalType = "laminal";
  }

  isVoiced() {
    return this.voicing.voiced;
  }
}

},{"../error/ipa-internal-error":14,"../error/ipa-syntax-error":15,"./manner":4,"./voicing":10}],3:[function(require,module,exports){
const SegmentHelper = require("./segment-helper");
const Articulation = require("./articulation");
const Place = require("./place");
const Voicing = require("./voicing");
const Affricate = require("./affricate");
const IpaSyntaxtError = require("../error/ipa-syntax-error");
const IpaInternError = require("../error/ipa-internal-error");

module.exports = class ConsonantBuilder {
  constructor(consonantDef) {
    this.state = "single-char";

    this.segmentHelper = new SegmentHelper();
    this.ejective = false;
    this.release = "unaspirated";
    this.secondary = "none";
    this.articulations = [];

    this._addArticulations(consonantDef);
  }

  addDiacritic(diacritic) {
    switch (diacritic.type) {
      case "tone": this.segmentHelper.addTone(diacritic.label); break;
      case "quantity": this.segmentHelper.updateQuantity(diacritic.label); break;
      case "syllabicity": this.segmentHelper.updateSyllabicity(diacritic.label); break;
      case "ejective": this.ejective = true; break;
      case "release": this._updateRelease(diacritic.label); break;
      case "secondary-articulation": this._updateSecondaryArticulation(diacritic.label); break;
      case "phonation": this._getCurrentArticulations().forEach(articulation => articulation.updatePhonation(diacritic.label)); break;
      case "articulation": this._getCurrentArticulations().forEach(articulation => articulation.updateArticulation(diacritic.label)); break;
      case "nasalized": this._getCurrentArticulations().forEach(articulation => articulation.nasalized()); break;
      case "roundedness":  /*TODO?*/ break;
      case "tongue-root": //fallthroug
      case "rhotacized": throw new IpaSyntaxtError("'" + diacritic.label + "' diacritic is not supported by consonant");
      default: throw new IpaInternError("Unsupported diacritic type: '" + diacritic.type + "'");
    }
  }

  addTieBar() {
    if (this.state != "single-char") throw new IpaSyntaxtError("Unexpected tie-bar. State=" + this.state);
    this.state = "expecting";
  }

  isExpectingConsonant() {
    return this.state === "expecting";
  }

  addConsonant(second) {
    if (!this.isExpectingConsonant()) throw new IpaSyntaxtError("Unexpected second articulation. State=" + this.state);

    this._addArticulations(second);
    this.state = "double-char";
  }

  _addArticulations(consonantDef) {
    if (this.articulations.length + consonantDef.places.length > 2) throw new IpaSyntaxtError("Can not manage more than 2 articulations for one consonant.");

    this.currentArticulationsLegnth = consonantDef.places.length;
    for (let placeIndex = 0; placeIndex < consonantDef.places.length; placeIndex++) {
      this.articulations.push(new Articulation(consonantDef, placeIndex));
    }
  }

  _getCurrentArticulations() {
    let index = this.articulations.length - this.currentArticulationsLegnth;
    return this.articulations.slice(index);
  }

  _updateSecondaryArticulation(label) {
    switch (label) {
      case "Labialized": this.secondary = "bilabial"; break;
      case "Palatalized": this.secondary = "palatal"; break;
      case "Velarized": this.secondary = "velar"; break;
      case "Velarized or pharyngealized": this.secondary = "velar"; break;
      case "Pharyngealized": this.secondary = "pharyngeal"; break;
      case "Labio-palatalized": throw new IpaSyntaxtError("Labio-palatization not supported");
      default: throw new IpaInternError("Unsupported secondary-articulation label: '" + label + "'");
    }
  }

  _updateRelease(label) {
    switch (label) {
      case "Aspirated": this.release = "aspirated"; break;
      case "Nasal": this.release = "nasal-release"; break;
      case "No audible": this.release = "no-audible-release"; break;
      case "Lateral": this.release = "lateral-release"; break;
      default: throw new IpaInternError("Unsupported release label: '" + label + "'");
    }
  }

  end() {
    if (this.isExpectingConsonant()) throw new IpaSyntaxtError("Unexpected end of consonant. Expected second articulation. State=" + this.state);

    let data = this._resolveArticulations();
    data.places = Place.orderPlaces(data.places);

    if (data.manner == "vowel") {
      return this._buildVowel(data);
    } else {
      data.ejective = this.ejective;
      data.secondary = this.secondary;
      data.release = this.release;
      if (!data.places.some(Place.isCoronal)) {
        delete data.coronalType;
      }

      return this.segmentHelper.buildConsonant(data);
    }
  }

  _buildVowel(data) {
    // see : https://en.wikipedia.org/wiki/Approximant_consonant#Semivowels
    let placeInfo = Place.approximantToVowel(data.places);
    let values = {
      "voicing": data.voicing,
      "height": placeInfo.height,
      "backness": placeInfo.backness,
      "rounded": placeInfo.rounded,
      "roundednessModifier": "none",
      "nasal": data.nasal,
      "rhotacized": false,
      "tongueRoot": "neutral"
    };
    return this.segmentHelper.buildVowel(values);
  }

  _resolveArticulations() {
    if (this.articulations.length == 1) {
      return this._resolveSingleArticulation(this.articulations[0]);
    }

    // If two articulations
    let first = this.articulations[0];
    let second = this.articulations[1];
    if (first.manner == second.manner) {
      return this._resolveCoarticulation(first, second, first.manner);
    }
    // If two articulation with differents manners
    switch (first.manner) {
      case "plosive": {
        switch (second.manner) {
          case "fricative": return this._resolveAffricate(first, second);
          case "trill": return this._resolveTrilledAffricate(first, second);
          case "implosive": return this._resolveCoarticulation(first, second, "implosive");
        }
      } break;
      case "flap": {
        // Ad-hoc case for retroflex trill 'ɽ͡r' & 'ɽ͡r̥' & ...
        if (second.manner == "trill") {
          return this._adhocRetroflexTrill(first, second);
        }
      }
    }
    // If do not match a valid combinaison
    throw new IpaSyntaxtError("Invalid articulations manner: '" + first.manner + "' + '" + second.manner + "'");
  }

  _resolveSingleArticulation(articulation) {
    return {
      "voicing": articulation.voicing.build(),
      "places": [articulation.place],
      "coronalType": articulation.coronalType,
      "manner": articulation.manner,
      "lateral": articulation.lateral,
      "nasal": articulation.nasal
    }
  }

  _resolveAffricate(first, second) {
    let affricatePlace = Affricate.computeAffricatePlace(first, second);
    let voicing = Affricate.computeAffricateVoicing(first, second);

    return {
      "voicing": voicing,
      "places": [affricatePlace],
      "coronalType": Place.mergeCoronalType(first.coronalType, second.coronalType),
      "manner": "affricate",
      "lateral": second.lateral,
      "nasal": second.nasal
    }
  }

  _resolveTrilledAffricate(first, second) {
    let affricatePlace = Affricate.computeTrilledAffricatePlace(first, second);
    let voicing = Affricate.computeTrilledAffricateVoicing(first, second);

    return {
      "voicing": voicing,
      "places": [affricatePlace],
      "coronalType": Place.mergeCoronalType(first.coronalType, second.coronalType),
      "manner": "trilled-affricate",
      "lateral": second.lateral,
      "nasal": second.nasal
    }
  }

  _resolveCoarticulation(first, second, manner) {
    if (first.isVoiced() != second.isVoiced()) throw new IpaSyntaxtError("Invalid voicing for coarticulation")

    return {
      "voicing": Voicing.merge(first.voicing, second.voicing),
      "places": [first.place, second.place],
      "coronalType": Place.mergeCoronalType(first.coronalType, second.coronalType),
      "manner": manner,
      "lateral": first.lateral || second.lateral,
      "nasal": first.nasal || second.nasal
    };
  }

  _adhocRetroflexTrill(first, second) {
    if (!(first.place == "retroflex" && second.place == "alveolar")) {
      throw new IpaSyntaxtError("Invalid place for the ad-hoc retroflex trill: '" + first.place + "' + '" + second.place + "'");
    }

    return {
      "voicing": second.voicing.build(),
      "places": ["retroflex"],
      "coronalType": first.coronalType,
      "manner": "trill",
      "lateral": false,
      "nasal": second.nasal
    }
  }
}
},{"../error/ipa-internal-error":14,"../error/ipa-syntax-error":15,"./affricate":1,"./articulation":2,"./place":5,"./segment-helper":6,"./voicing":10}],4:[function(require,module,exports){
// TODO : finish lower/raise
// see https://en.wikipedia.org/wiki/Relative_articulation#Raised_and_lowered
//
// [vowel]-[approximant]--[fricative]--------<[stop]
//                        [tap  fric]--[flap]>[stop]
//               [trill]--[tril fric]-- XXX
//
// trilled fricative = trill + fricative ? => https://en.wikipedia.org/wiki/Dental,_alveolar_and_postalveolar_trills#Voiced_alveolar_fricative_trill
// https://en.wikipedia.org/wiki/Fricative_consonant :
//  - fricative trill 
//  - fricative flap
// https://en.wikipedia.org/wiki/Flap_consonant#Tapped_fricatives
// One fricative flap : https://en.wikipedia.org/wiki/Voiced_alveolar_fricative#Voiced_alveolar_non-sibilant_fricative
//

function lower(manner) {
  switch (manner) {
    case "stop": return "fricative";
    case "fricative": return "approximant";
    case "approximant": return "vowel";
    case "flap": return "tapped-fricative";
    case "tapped-fricative": return "tapped-fricative";
    case "trill": return "trill";
    case "trilled-fricative": return "trill";
    case "vowel": return "vowel";

    default: throw new IpaInternError("Unsupported manner: '" + manner + "'");
  }
}

function raise(manner) {
  switch (manner) {
    case "stop": return "stop";
    case "fricative": return "stop";
    case "approximant": return "fricative";
    case "flap": return "stop";
    case "tapped-fricative": return "flap";
    case "trill": return "trilled-fricative";
    case "trilled-fricative": return "trilled-fricative";
    case "vowel": return "approximant";

    default: throw new IpaInternError("Unsupported manner: '" + manner + "'");
  }
}

module.exports = {
  lower: lower,
  raise: raise
}
},{}],5:[function(require,module,exports){
const IpaSyntaxtError = require("../error/ipa-syntax-error");
const Backness = require("../constants").Backness;
const Height = require("../constants").Height;

const coronals = ["dental",
  "alveolar",
  "postalveolar",
  "retroflex",
  "alveopalatal"];

const places = [
  "bilabial",
  "labiodental",
  "dental",
  "alveolar",
  "postalveolar",
  "retroflex",
  "alveopalatal",
  "palatal",
  "velar",
  "uvular",
  "pharyngal",
  "epiglottal",
  "glottal"
];

const placeMap = {};
for (let i = 0; i < places.length; i++) {
  placeMap[places[i]] = i;
}

function orderPlace(places) {
  return places
    .map((name) => { return { "name": name, "index": placeMap[name] } }) // Create an array with the name and the index 
    .sort((a, b) => a.index - b.index) // order according to the index
    .map(data => data.name); // return an array with only the name (remove the index)
}

function isCoronal(place) {
  return coronals.includes(place);
}

function mergeCoronalType(first, second) {
  if (first == "unspecified") return second;
  if (second == "unspecified") return first;
  throw new IpaSyntaxtError("Can not merge coronal types: '" + first + "' + '" + second + '"');
}

function approximantToVowel(places) {
  // If two place, the first should be bilabial
  // The last place should defined the backness
  //  - palatal => Front vowel
  //  - velar => Back vowel
  let backness;
  let backnessPlace = places[places.length - 1];
  switch (backnessPlace) {
    case "palatal": backness = Backness["FRONT"]; break;
    case "velar": backness = Backness["BACK"]; break;
    default: throw new IpaSyntaxtError("Unsupported place for lowered approximant : " + backnessPlace);
  }

  let rounded = (places[0] == "bilabial");

  return {
    "backness": backness,
    "rounded": rounded,
    "height": Height["CLOSE"]
  }
}

module.exports = {
  orderPlaces: orderPlace,
  isCoronal: isCoronal,
  mergeCoronalType: mergeCoronalType,
  approximantToVowel: approximantToVowel
}
},{"../constants":12,"../error/ipa-syntax-error":15}],6:[function(require,module,exports){
const ToneMarkHelper = require("./tone-mark-helper");
const IpaSyntaxError = require("../error/ipa-syntax-error");
const IpaInternError = require("../error/ipa-internal-error");

module.exports = class SegmentHelper {
  constructor() {
    this.quantity = "short";
    this.syllabicModifier = "none";
    this.toneMarkHelper = new ToneMarkHelper();
  }

  addTone(toneLabel) {
    this.toneMarkHelper.addTone(toneLabel);
  }

  updateQuantity(label) {
    switch (this.quantity) {
      case "extra-short": //fallthroug
      case "half-long": //fallthroug
      case "extra-long": throw new IpaSyntaxError("Unexpected quantity symbol: '" + label + "' current quantity: " + this.quantity);
      case "long":
        if (label != "long") throw new IpaSyntaxError("Unexpected quantity symbol: " + label + " current quantity: " + this.quantity);
        this.quantity = "extra-long";
        break;
      case "short": this.quantity = label; break;
      default: throw new IpaInternError("Unsupported quantity label: '" + label + "'");
    }
  }

  updateSyllabicity(label) {
    if (this.syllabicModifier != "none") throw new IpaSyntaxtError("Do not supported more than one syllabic modifier");

    switch (label) {
      case "Syllabic": this.syllabicModifier = "+syllabic"; break;
      case "Non-syllabic": this.syllabicModifier = "-syllabic"; break;
      default: throw new IpaInternError("Unsupported syllabicity label: '" + label + "'");
    }
  }

  buildConsonant(values) {
    return this._build("consonant", false, values);
  }

  buildVowel(values) {
    return this._build("vowel", true, values);
  }

  _build(category, defaultSyllabicity, values) {
    let syllabic = this._computeSyllabic(defaultSyllabicity);

    let segment = {
      "segment": true,
      "category": category,
      "quantity": this.quantity,
      "syllabic": syllabic
    }

    for (let key in values) {
      segment[key] = values[key];
    }

    let result = [segment];

    if (this.toneMarkHelper.isTone()) {
      result.push(this.toneMarkHelper.buildTone());
    }

    return result;
  }

  _computeSyllabic(defaultSyllabicity) {
    switch (this.syllabicModifier) {
      case "+syllabic": return true;
      case "-syllabic": return false;
      default: return defaultSyllabicity;
    }
  }
}
},{"../error/ipa-internal-error":14,"../error/ipa-syntax-error":15,"./tone-mark-helper":8}],7:[function(require,module,exports){
const IpaInternError = require("../error/ipa-internal-error");

const map = {
  "extra-low": 1,
  "low": 2,
  "mid": 3,
  "high": 4,
  "extra-high": 5
};

module.exports = class ToneLettersBuilder {
  constructor(tone) {
    this.heights = [map[tone.label]];
    this.firstLabel = tone.label;
  }

  addTone(tone) {
    this.heights.push(map[tone.label])
  }

  end() {
    let label = this._computeLabel();
    return [{ "segment": false, "category": "tone", "label": label, "heights": this.heights }];
  }

  _computeLabel() {

    let state = "flat";

    for (let i = 1; i < this.heights.length; i++) {
      let currentHeight = this.heights[i];
      let lastHeight = this.heights[i - 1];
      if (currentHeight == lastHeight) {
        // do nothing
      } else if (currentHeight > lastHeight) {
        // rise
        switch (state) {
          case "flat":
            if (lastHeight >= 3) {
              state = "high-rising";
            } else if (currentHeight <= 3) {
              state = "low-rising";
            } else {
              state = "rising";
            }
            break;

          case "low-rising":
            if (currentHeight > 3) {
              state = "rising";
            }//else stay at low-rising 
            break;

          case "low-falling":
          case "high-falling":
          case "falling":
            state = "falling-rising"; break;

          case "rising-falling":
            return "other";

          case "high-rising":
          case "rising":
          case "falling-rising":
            // do nothing
            break;
          default: throw new IpaInternError("Invalid tone-letter-builder state: '" + state + "'");
        }
      } else {
        // fall
        switch (state) {
          case "flat":
            if (lastHeight <= 3) {
              state = "low-falling";
            } else if (currentHeight >= 3) {
              state = "high-falling";
            } else {
              state = "falling";
            }
            break;

          case "high-falling":
            if (currentHeight < 3) {
              state = "falling";
            } // else stay at high-falling
            break;

          case "low-rising":
          case "high-rising":
          case "rising":
            state = "rising-falling"; break;

          case "falling-rising":
            return "other";

          case "low-falling":
          case "falling":
          case "rising-falling":
            // do nothing
            break;
          default: throw new IpaInternError("Invalid tone-letter-builder state: '" + state + "'");
        }
      }
    }

    if (state === "flat") {
      return this.firstLabel;
    }

    return state;
  }
}
},{"../error/ipa-internal-error":14}],8:[function(require,module,exports){
const IpaSyntaxtError = require("../error/ipa-syntax-error");

const toneHeights = {
  "extra-high": [5],
  "high": [4],
  "mid": [3],
  "low": [2],
  "extra-low": [1],
  "rising": [1, 5],
  "falling": [5, 1],
  "high-rising": [4, 5],
  "low-rising": [1, 2],
  "low-falling": [2, 1],
  "high-falling": [5, 4],
  "rising-falling": [3, 4, 3],
  "falling-rising": [3, 2, 3]
};

module.exports = class ToneMarkHelper {
  constructor() {
    this.label = null;
  };

  addTone(label) {
    if (this.label == null) {
      this.label = label;
    } else {
      throw new IpaSyntaxtError("Do not supported more than one tone mark. Previous: '" + this.label + "' New: '" + label + "'");
    }
  }

  isTone() {
    return this.label != null;
  }

  buildTone() {
    return {
      "segment": false,
      "category": "tone",
      "label": this.label,
      "heights": toneHeights[this.label]
    };
  }
};
},{"../error/ipa-syntax-error":15}],9:[function(require,module,exports){
const VowelBuilder = require("./vowel-builder");
const ConsonantBuilder = require("./consonant-builder");
const ToneLettersBuilder = require("./tone-letters-builder");

const IpaInternalError = require("../error/ipa-internal-error");
const IpaSyntaxtError = require("../error/ipa-syntax-error");

module.exports = class UnitsBuilder {
  constructor() {
    this.state = "init";
    this.units = [];
    this.currentBuilder = null;
  }

  add(data) {
    switch (data.type) {
      case "vowel": {
        this._endCurrentBuilder();
        this.currentBuilder = new VowelBuilder(data);
        this.state = "vowel";
      }; break;

      case "consonant": {
        if (this.state == "consonant" && this.currentBuilder.isExpectingConsonant()) {
          this.currentBuilder.addConsonant(data);
        } else {
          this._endCurrentBuilder();
          this.currentBuilder = new ConsonantBuilder(data);
          this.state = "consonant";
        }
      }; break;

      case "tone-letter": {
        if (this.state == "tone-letter") {
          this.currentBuilder.addTone(data);
        } else {
          this._endCurrentBuilder();
          this.currentBuilder = new ToneLettersBuilder(data);
          this.state = "tone-letter";
        }
      }; break;

      case "diacritic": {
        if (this.state == "vowel" || this.state == "consonant") {
          this.currentBuilder.addDiacritic(data.diacritic);
        } else {
          throw new IpaSyntaxtError("Diacritic without vowel or consonant");
        }
      }; break;

      case "supra": {
        this._endCurrentBuilder();
        this.units.push(this._buildSupra(data));
        this.state = "init";
      }; break;

      case "tie-bar": {
        if (this.state != "consonant") {
          throw new IpaSyntaxtError("Tie-Bar without consonant");
        }
        this.currentBuilder.addTieBar();
      }; break;

      default: throw new IpaInternalError("Unsupported data type : '" + data.type + "'");
    }
  }

  spacing() {
    this._endCurrentBuilder();
    this.state = "init";
  }

  end() {
    this._endCurrentBuilder();
    return this.units;
  }

  _endCurrentBuilder() {
    if (this.currentBuilder != null) {
      this.units = this.units.concat(this.currentBuilder.end());
      this.currentBuilder = null;
    }
  }

  _buildSupra(data) {
    return { "segment": false, "category": data.category, "value": data.value };
  }
}
},{"../error/ipa-internal-error":14,"../error/ipa-syntax-error":15,"./consonant-builder":3,"./tone-letters-builder":7,"./vowel-builder":11}],10:[function(require,module,exports){
const IpaSyntaxtError = require("../error/ipa-syntax-error");

module.exports = class VoicingHelper {
  constructor(voiced) {
    this.voiced = voiced;
    this.phonation = voiced ? "modal" : "voiceless";
  }

  addDiacritic(label) {
    switch (label) {
      case "Voiceless": {
        this.voiced = false;
        this.phonation = "voiceless";
      }; break;
      case "Voiced": {
        this.voiced = true;
        this.phonation = "modal";
      }; break;
      case "Breathy voice": {
        this.voiced = true;
        this.phonation = "breathy";
      }; break;
      case "Creaky voice": {
        this.voiced = true;
        this.phonation = "creaky";
      }; break;
      default: throw new IpaInternalError("Unsupported voicing label: '" + label + "'");
    }
  }

  build() {
    return {
      "voiced": this.voiced,
      "phonation": this.phonation,
    }
  }
}

module.exports.merge = function(first, second) {
  if (second.voiced != first.voiced) {
    throw new IpaSyntaxtError("Can not merge. Not same voicing");
  }

  let phonation = (first.phonation == "modal" ? second.phonation : first.phonation);

  return {
    "voiced": first.voiced,
    "phonation": phonation
  }
}
},{"../error/ipa-syntax-error":15}],11:[function(require,module,exports){
const SegmentHelper = require("./segment-helper");
const Voicing = require("./voicing");
const VowelBackness = require("../constants").Backness;
const VowelHeight = require("../constants").Height;
const IpaSyntaxtError = require("../error/ipa-syntax-error");

module.exports = class VowelBuilder {
  constructor(vowel) {
    this.segmentHelper = new SegmentHelper();
    this.voicing = new Voicing(true);
    this.height = vowel.height;
    this.backness = vowel.backness;
    this.rounded = vowel.rounded;
    this.roundednessModifier = "none";
    this.nasal = false;
    this.rhotacized = false;
    this.tongueRoot = "neutral";
  }

  _updatePhonation(label) {
    this.voicing.addDiacritic(label);
  }

  _centralize() {
    this.backness = VowelBackness.CENTRAL;
  }

  _midCendtralize() {
    if (this.backness > 0) {
      this.backness--;
    } else if (this.backness < 0) {
      this.backness++;
    }

    if (this.height > 0) {
      this.height--;
    } else if (this.height < 0) {
      this.height++;
    }
  }

  _lower() {
    if (this.height > VowelHeight.OPEN) {
      this.height += -1;
    }
  }

  _raise() {
    if (this.height < VowelHeight.CLOSE) {
      this.height += +1;
    }
  }

  _advance() {
    if (this.backness < VowelBackness.FRONT) {
      this.backness += +1;
    }
  }

  _retracte() {
    if (this.backness > VowelBackness.BACK) {
      this.backness += -1;
    }
  }

  _updateArticulation(label) {
    switch (label) {
      case "Advanced": this._advance(); break;
      case "Retracted": this._retracte(); break;
      case "Centralized": this._centralize(); break;
      case "Mid-centralized": this._midCendtralize(); break;
      case "Raised": this._raise(); break;
      case "Lowered": this._lower(); break;
      case "Dental": //fallthroug
      case "Apical": //fallthroug
      case "Linguolabial": //fallthroug
      case "Laminal": throw new IpaSyntaxtError("'" + label + "' diacritic is not supported by vowel");
      default: throw new IpaInternalError("Unsupported articulation: '" + label + "'");
    }
  }

  _updateRoundedness(label) {
    switch (label) {
      case "More rounded": this.roundednessModifier = "more"; break;
      case "Less rounded": this.roundednessModifier = "less"; break;
      default: throw new IpaInternalError("Unsupported roundedness: '" + label + "'");
    }
  }

  _updateTongueRoot(label) {
    switch (label) {
      case "Advanced tongue root": this.tongueRoot = "advanced"; break;
      case "Retracted tongue root": this.tongueRoot = "retracted"; break;
      default: throw new IpaInternalError("Unsupported tongue-root: '" + label + "'");
    }
  }

  addDiacritic(diacritic) {
    switch (diacritic.type) {
      case "tone": this.segmentHelper.addTone(diacritic.label); break;
      case "quantity": this.segmentHelper.updateQuantity(diacritic.label); break;
      case "syllabicity": this.segmentHelper.updateSyllabicity(diacritic.label); break;
      case "phonation": this._updatePhonation(diacritic.label); break;
      case "articulation": this._updateArticulation(diacritic.label); break;
      case "nasalized": this.nasal = true; break;
      case "rhotacized": this.rhotacized = true; break;
      case "roundedness": this._updateRoundedness(diacritic.label); break;
      case "tongue-root": this._updateTongueRoot(diacritic.label); break;
      case "release": //fallthroug
      case "ejective"://fallthroug
      case "secondary-articulation":
        throw new IpaSyntaxtError("'" + diacritic.type + "' diacritic is not supported by vowel");
      default: throw new IpaInternalError("Unsupported diacritic type: '" + diacritic.type + "'");
    }
  }

  end() {
    return this.segmentHelper.buildVowel({
      "voicing": this.voicing.build(),
      "height": this.height,
      "backness": this.backness,
      "rounded": this.rounded,
      "roundednessModifier": this.roundednessModifier,
      "nasal": this.nasal,
      "rhotacized": this.rhotacized,
      "tongueRoot": this.tongueRoot
    });
  }
}
},{"../constants":12,"../error/ipa-syntax-error":15,"./segment-helper":6,"./voicing":10}],12:[function(require,module,exports){
const VowelBackness = Object.freeze({
  "FRONT": 2,
  "NEAR_FRONT": 1,
  "CENTRAL": 0,
  "NEAR_BACK": -1,
  "BACK": -2
});

const VowelHeight = Object.freeze({
  "CLOSE": 3,
  "NEAR_CLOSE": 2,
  "CLOSE_MID": 1,
  "MID": 0,
  "OPEN_MID": -1,
  "NEAR_OPEN": -2,
  "OPEN": -3
});

module.exports.Height = VowelHeight;
module.exports.Backness = VowelBackness;
},{}],13:[function(require,module,exports){
module.exports = class IpaCharacterError extends Error {
  constructor(character) {
    super("Invalid IPA character: " + character);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IpaCharacterError);
    }
  }
}

},{}],14:[function(require,module,exports){
module.exports = class IpaInternalError extends Error {
  constructor(message) {
    super("Unexpected Error. " + message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IpaInternalError);
    }
  }
}
},{}],15:[function(require,module,exports){
module.exports = class IpaSyntaxError extends Error {
  constructor(message) {
    super("Invalid IPA syntax." + message);
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IpaSyntaxError);
    }
  }
}
},{}],16:[function(require,module,exports){
const IpaParserFactory = require("./ipa-parser-factory");
const height = require("./constants").Height;
const backness = require("./constants").Backness;

module.exports = {
  parser: new IpaParserFactory().get(),
  height,
  backness
}
},{"./constants":12,"./ipa-parser-factory":17}],17:[function(require,module,exports){

var Mapper = require('./mapper');
var VowelHeight = require('./constants').Height;
var VowelBackness = require('./constants').Backness;
var IpaParser = require('./ipa-parser');

module.exports = class IpaParserFactory {
  get() {
    // -- Normalization
    var alternatives = JSON.parse("{   \r\n  \"\\u02A6\": { \"target\": \"t͡s\",           \"unicode\": \"LATIN SMALL LETTER TS DIGRAPH\" },\r\n  \"\\u02A3\": { \"target\": \"d͡z\",           \"unicode\": \"LATIN SMALL LETTER DZ DIGRAPH\" },\r\n  \"\\u02A7\": { \"target\": \"t͡ʃ\",           \"unicode\": \"LATIN SMALL LETTER TESH DIGRAPH\" },\r\n  \"\\u02A4\": { \"target\": \"d͡ʒ\",           \"unicode\": \"LATIN SMALL LETTER DEZH DIGRAPH\" },\r\n  \"\\u02A8\": { \"target\": \"t͡ɕ\",           \"unicode\": \"LATIN SMALL LETTER TC DIGRAPH WITH CURL\" },\r\n  \"\\u02A5\": { \"target\": \"d͡ʑ\",           \"unicode\": \"LATIN SMALL LETTER DZ DIGRAPH WITH CURL\" },\r\n  \"\\u025A\": { \"target\": \"\\u0259\\u02DE\", \"unicode\": \"LATIN SMALL LETTER SCHWA WITH HOOK\" },\r\n  \"\\u025D\": { \"target\": \"\\u025C\\u02DE\", \"unicode\": \"LATIN SMALL LETTER REVERSED OPEN E WITH HOOK\" },\r\n  \"\\u026B\": { \"target\": \"l\\u0334\"       },\r\n   \r\n  \"\\u035C\": { \"target\": \"\\u0361\", \"unicode\": \"COMBINING DOUBLE BREVE BELOW\",  \"target-unicode\": \"COMBINING DOUBLE INVERTED BREVE\" },\r\n  \"\\u030D\": { \"target\": \"\\u0329\", \"unicode\": \"COMBINING VERTICAL LINE ABOVE\", \"target-unicode\": \"COMBINING VERTICAL LINE BELOW\" },\r\n  \"\\u0311\": { \"target\": \"\\u032F\", \"unicode\": \"COMBINING INVERTED BREVE\",      \"target-unicode\": \"COMBINING INVERTED BREVE BELOW\" },\r\n  \"\\u030A\": { \"target\": \"\\u0325\", \"unicode\": \"COMBINING RING ABOVE\",          \"target-unicode\": \"COMBINING RING BELOW\" },\r\n  \"\\u02D7\": { \"target\": \"\\u0320\", \"unicode\": \"MODIFIER LETTER MINUS SIGN\",    \"target-unicode\": \"COMBINING MINUS SIGN BELOW\" },\r\n  \"\\u02D6\": { \"target\": \"\\u031F\", \"unicode\": \"MODIFIER LETTER PLUS SIGN\",     \"target-unicode\": \"COMBINING PLUS SIGN BELOW\" },\r\n  \"\\u02D4\": { \"target\": \"\\u031D\", \"unicode\": \"MODIFIER LETTER UP TACK\",       \"target-unicode\": \"COMBINING UP TACK BELOW\" },\r\n  \"\\u02D5\": { \"target\": \"\\u031E\", \"unicode\": \"MODIFIER LETTER DOWN TACK\",     \"target-unicode\": \"COMBINING DOWN TACK BELOW\"},\r\n  \r\n  \"\\u0067\": { \"target\": \"\\u0261\", \"unicode\": \"LATIN SMALL LETTER G\",          \"target-unicode\": \"LATIN SMALL LETTER SCRIPT G\" },\r\n  \"\\u003A\": { \"target\": \"\\u02D0\", \"unicode\": \"COLON\",                         \"target-unicode\": \"MODIFIER LETTER TRIANGULAR COLON\" },\r\n  \r\n  \"\\u02C1\": { \"target\": \"\\u02E4\", \"unicode\": \"Modifier Letter Reversed Glottal Stop\", \"target-unicode\": \"Modifier Letter Small Reversed Glottal Stop\" }\r\n}");
    let normalization = {};
    for (let key in alternatives) {
      normalization[key] = alternatives[key].target;
    }

    // -- Symbol mapping
    let mapper = new Mapper();

    // Diacritics
    let diacritics = JSON.parse("{\r\n  \"syllabicity\":{\r\n    \"\\u0329\": { \"visual\":\"◌̩\",  \"ipa\": \"Syllabic\",     \"unicode\": \"COMBINING VERTICAL LINE BELOW\"},\r\n    \"\\u032F\": { \"visual\":\"◌̯\",  \"ipa\": \"Non-syllabic\", \"unicode\": \"COMBINING INVERTED BREVE BELOW\"}\r\n  },\r\n  \"release\":{\r\n    \"\\u207F\": { \"visual\":\"◌ⁿ\", \"ipa\": \"Nasal\",        \"unicode\": \"SUPERSCRIPT LATIN SMALL LETTER N\"},\r\n    \"\\u031A\": { \"visual\":\"◌̚\",  \"ipa\": \"No audible\",   \"unicode\": \"COMBINING LEFT ANGLE ABOVE\"},\r\n    \"\\u02E1\": { \"visual\":\"◌ˡ\", \"ipa\": \"Lateral\",      \"unicode\": \"MODIFIER LETTER SMALL L\"},\r\n    \"\\u02B0\": { \"visual\":\"◌ʰ\", \"ipa\": \"Aspirated\",    \"unicode\": \"MODIFIER LETTER SMALL H\"}\r\n  },\r\n  \"phonation\":{\r\n    \"\\u0325\": { \"visual\":\"◌̥\", \"ipa\": \"Voiceless\",     \"unicode\": \"COMBINING RING BELOW\"},\r\n    \"\\u032C\": { \"visual\":\"◌̬\", \"ipa\": \"Voiced\",        \"unicode\": \"COMBINING CARON BELOW\"},\r\n    \"\\u0324\": { \"visual\":\"◌̤\", \"ipa\": \"Breathy voice\", \"unicode\": \"COMBINING DIAERESIS BELOW\"},\r\n    \"\\u0330\": { \"visual\":\"◌̰\", \"ipa\": \"Creaky voice\",  \"unicode\": \"COMBINING TILDE BELOW\"}\r\n  },\r\n  \"articulation\":{\r\n    \"\\u032A\": { \"ipa\": \"Dental\",          \"unicode\": \"COMBINING BRIDGE BELOW\"}, \r\n    \"\\u033A\": { \"ipa\": \"Apical\",          \"unicode\": \"COMBINING INVERTED BRIDGE BELOW\"},\r\n    \"\\u033C\": { \"ipa\": \"Linguolabial\",    \"unicode\": \"COMBINING SEAGULL BELOW\"},\r\n    \"\\u033B\": { \"ipa\": \"Laminal\",         \"unicode\": \"COMBINING SQUARE BELOW\"},\r\n    \"\\u031F\": { \"ipa\": \"Advanced\",        \"unicode\": \"COMBINING PLUS SIGN BELOW\"},\r\n    \"\\u0320\": { \"ipa\": \"Retracted\",       \"unicode\": \"COMBINING MINUS SIGN BELOW\"},\r\n    \"\\u0308\": { \"ipa\": \"Centralized\",     \"unicode\": \"COMBINING DIAERESIS\"},\r\n    \"\\u033D\": { \"ipa\": \"Mid-centralized\", \"unicode\": \"COMBINING X ABOVE\"},\r\n    \"\\u031D\": { \"ipa\": \"Raised\",          \"unicode\": \"COMBINING UP TACK BELOW\"},\r\n    \"\\u031E\": { \"ipa\": \"Lowered\",         \"unicode\": \"COMBINING DOWN TACK BELOW\"}\r\n  },\r\n  \"secondary-articulation\":{\r\n    \"\\u02B7\": { \"ipa\": \"Labialized\",            \"unicode\": \"MODIFIER LETTER SMALL W\"},\r\n    \"\\u02B2\": { \"ipa\": \"Palatalized\",           \"unicode\": \"MODIFIER LETTER SMALL J\"},\r\n    \"\\u1DA3\": { \"ipa\": \"Labio-palatalized\",     \"unicode\": \"MODIFIER LETTER SMALL TURNED H\"},\r\n    \"\\u02E0\": { \"ipa\": \"Velarized\",             \"unicode\": \"MODIFIER LETTER SMALL GAMMA\"},\r\n    \"\\u02E4\": { \"ipa\": \"Pharyngealized\",        \"unicode\": \"MODIFIER LETTER SMALL REVERSED GLOTTAL STOP\"},\r\n    \"\\u0334\": { \"ipa\": \"Velarized or pharyngealized\", \"unicode\": \"COMBINING TILDE OVERLAY\"}\r\n  },\r\n  \"nasalized\":{\r\n    \"\\u0303\": { \"ipa\": \"Nasalized\",             \"unicode\": \"COMBINING TILDE\"}\r\n  },\r\n  \"rhotacized\":{\r\n    \"\\u02DE\": { \"ipa\": \"Rhotacized\",            \"unicode\": \"MODIFIER LETTER RHOTIC HOOK\"}\r\n  },\r\n  \"roundedness\":{\r\n    \"\\u0339\": { \"ipa\": \"More rounded\",          \"unicode\": \"COMBINING RIGHT HALF RING BELOW\"},\r\n    \"\\u031C\": { \"ipa\": \"Less rounded\",          \"unicode\": \"COMBINING LEFT HALF RING BELOW\"}\r\n  },\r\n  \"tongue-root\":{\r\n    \"\\u0318\": { \"ipa\": \"Advanced tongue root\",  \"unicode\": \"COMBINING LEFT TACK BELOW\"},\r\n    \"\\u0319\": { \"ipa\": \"Retracted tongue root\", \"unicode\": \"COMBINING RIGHT TACK BELOW\"}\r\n  }\r\n}");
    for (let type in diacritics) {
      let typeBundle = diacritics[type];
      for (let key in typeBundle) {
        let diacritic = typeBundle[key];
        mapper.addDiacritic(key, type, diacritic.ipa);
      }
    }

    // Vowels
    let vowels = JSON.parse("{\r\n  \"CLOSE\":{\r\n    \"FRONT\":[\"i\",\"y\"],\r\n    \"CENTRAL\":[\"ɨ\",\"ʉ\"],\r\n    \"BACK\":[\"ɯ\",\"u\"]\r\n  },\r\n  \"NEAR_CLOSE\":{\r\n    \"NEAR_FRONT\":[\"ɪ\",\"ʏ\"],\r\n    \"NEAR_BACK\": [null,\"ʊ\"]\r\n  },\r\n  \"CLOSE_MID\":{\r\n    \"FRONT\":[\"e\",\"ø\"],\r\n    \"CENTRAL\":[\"ɘ\",\"ɵ\"],\r\n    \"BACK\":[\"ɤ\",\"o\"]\r\n  },\r\n  \"MID\":{\r\n    \"CENTRAL\":[\"ə\",null]\r\n  },  \r\n  \"OPEN_MID\":{\r\n    \"FRONT\":[\"ɛ\",\"œ\"],\r\n    \"CENTRAL\":[\"ɜ\",\"ɞ\"],\r\n    \"BACK\":[\"ʌ\",\"ɔ\"]\r\n  },\r\n  \"NEAR_OPEN\":{\r\n    \"FRONT\":[\"æ\",null],\r\n    \"CENTRAL\":[\"ɐ\",null]\r\n  },\r\n  \"OPEN\":{\r\n    \"FRONT\":[\"a\",\"ɶ\"],\r\n    \"BACK\":[\"ɑ\",\"ɒ\"]\r\n  }      \r\n}");
    for (let heightLabel in vowels) {
      let heightBundle = vowels[heightLabel];
      for (let backnessLabel in heightBundle) {
        let couple = heightBundle[backnessLabel];

        let height = VowelHeight[heightLabel];
        let backness = VowelBackness[backnessLabel];

        let unroundedVowel = couple[0];
        if (unroundedVowel) {
          mapper.addVowel(unroundedVowel, height, backness, false);
        }
        let roundedVowel = couple[1];
        if (roundedVowel) {
          mapper.addVowel(roundedVowel, height, backness, true);
        }
      }
    }

    // Consonants
    let consonants = JSON.parse("{\r\n  \"combining\":[\"\\u0361\",\"\\u035C\"],\r\n  \"ejective\": [\"ʼ\", \"'\"],\r\n  \"symbol\":{\r\n    \"nasal\":{\r\n      \"m\":{\"place\":\"bilabial\",        \"voiced\":true},\r\n      \"ɱ\":{\"place\":\"labiodental\",     \"voiced\":true},\r\n      \"n\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"ɳ\":{\"place\":\"retroflex\",       \"voiced\":true},\r\n      \"ɲ\":{\"place\":\"palatal\",         \"voiced\":true},\r\n      \"ŋ\":{\"place\":\"velar\",           \"voiced\":true},\r\n      \"ɴ\":{\"place\":\"uvular\",          \"voiced\":true}\r\n    },\r\n    \"plosive\":{\r\n      \"p\":{\"place\":\"bilabial\",        \"voiced\":false},\r\n      \"b\":{\"place\":\"bilabial\",        \"voiced\":true},\r\n      \"t\":{\"place\":\"alveolar\",        \"voiced\":false},\r\n      \"d\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"ʈ\":{\"place\":\"retroflex\",       \"voiced\":false},\r\n      \"ɖ\":{\"place\":\"retroflex\",       \"voiced\":true},\r\n      \"c\":{\"place\":\"palatal\",         \"voiced\":false},\r\n      \"ɟ\":{\"place\":\"palatal\",         \"voiced\":true},\r\n      \"k\":{\"place\":\"velar\",           \"voiced\":false},\r\n      \"ɡ\":{\"place\":\"velar\",           \"voiced\":true},\r\n      \"q\":{\"place\":\"uvular\",          \"voiced\":false},\r\n      \"ɢ\":{\"place\":\"uvular\",          \"voiced\":true},\r\n      \"ʡ\":{\"place\":\"epiglottal\",       \"voiced\":false},\r\n      \"ʔ\":{\"place\":\"glottal\",          \"voiced\":false}\r\n    },\r\n    \"fricative\":{\r\n      \"ɸ\":{\"place\":\"bilabial\",        \"voiced\":false},\r\n      \"β\":{\"place\":\"bilabial\",        \"voiced\":true},\r\n      \"f\":{\"place\":\"labiodental\",     \"voiced\":false},\r\n      \"v\":{\"place\":\"labiodental\",     \"voiced\":true},\r\n      \"θ\":{\"place\":\"dental\",          \"voiced\":false},\r\n      \"ð\":{\"place\":\"dental\",          \"voiced\":true},\r\n      \"s\":{\"place\":\"alveolar\",        \"voiced\":false},\r\n      \"z\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"ɬ\":{\"place\":\"alveolar\",        \"voiced\":false, \"lateral\":true},\r\n      \"ɮ\":{\"place\":\"alveolar\",        \"voiced\":true,  \"lateral\":true},\r\n      \"ʃ\":{\"place\":\"postalveolar\",    \"voiced\":false},\r\n      \"ʒ\":{\"place\":\"postalveolar\",    \"voiced\":true},\r\n      \"ɧ\":{\"place\":[\"postalveolar\",\"velar\"], \"voiced\":false},\r\n      \"ʂ\":{\"place\":\"retroflex\",       \"voiced\":false},\r\n      \"ʐ\":{\"place\":\"retroflex\",       \"voiced\":true},\r\n      \"ɕ\":{\"place\":\"alveopalatal\",    \"voiced\":false},\r\n      \"ʑ\":{\"place\":\"alveopalatal\",    \"voiced\":true},\r\n      \"ç\":{\"place\":\"palatal\",         \"voiced\":false},\r\n      \"ʝ\":{\"place\":\"palatal\",         \"voiced\":true},\r\n      \"x\":{\"place\":\"velar\",           \"voiced\":false},\r\n      \"ɣ\":{\"place\":\"velar\",           \"voiced\":true},\r\n      \"ʍ\":{\"place\":[\"bilabial\",\"velar\"],  \"voiced\":false},\r\n      \"χ\":{\"place\":\"uvular\",          \"voiced\":false},\r\n      \"ʁ\":{\"place\":\"uvular\",          \"voiced\":true},\r\n      \"ħ\":{\"place\":\"pharyngeal\",       \"voiced\":false},\r\n      \"ʕ\":{\"place\":\"pharyngeal\",       \"voiced\":true},\r\n      \"h\":{\"place\":\"glottal\",         \"voiced\":false},\r\n      \"ɦ\":{\"place\":\"glottal\",         \"voiced\":true},\r\n      \"ʜ\":{\"place\":\"epiglottal\",      \"voiced\":false},\r\n      \"ʢ\":{\"place\":\"epiglottal\",      \"voiced\":true}\r\n    },\r\n    \"approximant\":{\r\n      \"ʋ\":{\"place\":\"labiodental\",     \"voiced\":true},\r\n      \"ɹ\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"l\":{\"place\":\"alveolar\",        \"voiced\":true, \"lateral\":true},     \r\n      \"ɻ\":{\"place\":\"retroflex\",       \"voiced\":true},\r\n      \"ɭ\":{\"place\":\"retroflex\",       \"voiced\":true, \"lateral\":true},\r\n      \"j\":{\"place\":\"palatal\",         \"voiced\":true},\r\n      \"ʎ\":{\"place\":\"palatal\",         \"voiced\":true, \"lateral\":true},\r\n      \"ɰ\":{\"place\":\"velar\",           \"voiced\":true},\r\n      \"ʟ\":{\"place\":\"velar\",           \"voiced\":true, \"lateral\":true},\r\n      \"w\":{\"place\":[\"bilabial\",\"velar\"],  \"voiced\":true},\r\n      \"ɥ\":{\"place\":[\"bilabial\",\"palatal\"],\"voiced\":true}\r\n    },\r\n    \"flap\":{\r\n      \"ⱱ\":{\"place\":\"labiodental\",     \"voiced\":true},\r\n      \"ɾ\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"ɺ\":{\"place\":\"alveolar\",        \"voiced\":true, \"lateral\":true},\r\n      \"ɽ\":{\"place\":\"retroflex\",       \"voiced\":true}\r\n    },\r\n    \"trill\":{\r\n      \"ʙ\":{\"place\":\"bilabial\",        \"voiced\":true},\r\n      \"r\":{\"place\":\"alveolar\",        \"voiced\":true},\r\n      \"ʀ\":{\"place\":\"uvular\",          \"voiced\":true}\r\n    },\r\n    \"implosive\":{\r\n      \"ɓ\":{\"place\":\"bilabial\",       \"voiced\":true},\r\n      \"ɗ\":{\"place\":\"alveolar\",       \"voiced\":true},\r\n      \"ᶑ\":{\"place\":\"retroflex\",      \"voiced\":true},\r\n      \"ʄ\":{\"place\":\"palatal\",        \"voiced\":true},\r\n      \"ɠ\":{\"place\":\"velar\",          \"voiced\":true},\r\n      \"ʛ\":{\"place\":\"uvular\",         \"voiced\":true}\r\n    },\r\n    \"click\":{\r\n      \"ʘ\":{\"place\":\"bilabial\",       \"voiced\":false},\r\n      \"ǀ\":{\"place\":\"dental\",         \"voiced\":false},\r\n      \"ǃ\":{\"place\":\"alveolar\",       \"voiced\":false},\r\n      \"ǁ\":{\"place\":\"alveolar\",       \"voiced\":false, \"lateral\":true},\r\n      \"ǂ\":{\"place\":\"postalveolar\",   \"voiced\":false}\r\n    }\r\n  }\r\n}");
    // Combining
    consonants.combining.forEach(key => mapper.addTieBar(key));
    consonants.ejective.forEach(key => mapper.addDiacritic(key, "ejective", "ejective"));

    for (let mannerName in consonants.symbol) {
      let mannerBundle = consonants.symbol[mannerName];
      for (let key in mannerBundle) {

        let consonant = mannerBundle[key];
        let lateral = (consonant.lateral ? true : false);
        let places = consonant.place;
        let nasal = false;
        let manner = mannerName;

        if (mannerName == "nasal") {
          manner = "plosive";
          nasal = true;
        }

        if (typeof (places) == "string") {
          places = [places];
        }

        mapper.addConsonant(key, manner, places, consonant.voiced, lateral, nasal);
      }
    }

    // Brackets
    let brackets = JSON.parse("[\r\n  {\r\n    \"type\": \"phonetic\",\r\n    \"start\": \"[\",\r\n    \"end\": \"]\"\r\n  },\r\n  {\r\n    \"type\": \"phonemic\",\r\n    \"start\": \"/\",\r\n    \"end\": \"/\"\r\n  },\r\n  {\r\n    \"type\": \"indistinguishable \",\r\n    \"start\": \"(\",\r\n    \"end\": \")\"\r\n  },\r\n  {\r\n    \"type\": \"obscured \",\r\n    \"start\": \"⸨\",\r\n    \"end\": \"⸩\"\r\n  },\r\n  {\r\n    \"type\": \"prosodic \",\r\n    \"start\": \"{\",\r\n    \"end\": \"}\"\r\n  }\r\n]");
    brackets.forEach(info => mapper.addBrackets(info.type, info.start, info.end));

    // Supra
    let supra = JSON.parse("{\r\n  \"diacritic\": {\r\n    \"quantity\": {\r\n      \"\\u02D0\": \"long\",\r\n      \"\\u02D1\": \"half-long\",\r\n      \"\\u0306\": \"extra-short\"\r\n    },\r\n    \"tone\": {\r\n      \"\\u030B\": \"extra-high\",\r\n      \"\\u0301\": \"high\",\r\n      \"\\u0304\": \"mid\",\r\n      \"\\u0300\": \"low\",\r\n      \"\\u030F\": \"extra-low\",\r\n      \"\\u030C\": \"rising\",\r\n      \"\\u0302\": \"falling\",\r\n      \"\\u1DC4\": \"high-rising\",\r\n      \"\\u1DC5\": \"low-rising\",\r\n      \"\\u1DC6\": \"low-falling\",\r\n      \"\\u1DC7\": \"high-falling\",\r\n      \"\\u1DC8\": \"rising-falling\",\r\n      \"\\u1DC9\": \"falling-rising\"\r\n    }\r\n  },\r\n  \"tone-letter\": {\r\n    \"˥\": \"extra-high\",\r\n    \"˦\": \"high\",\r\n    \"˧\": \"mid\",\r\n    \"˨\": \"low\",\r\n    \"˩\": \"extra-low\"\r\n  },\r\n  \"single-char\": {\r\n    \"stress\": {\r\n      \"ˈ\": \"primary-stress\",\r\n      \"ˌ\": \"secondary-stress\"\r\n    },\r\n    \"separator\": {\r\n      \"|\": \"minor-group\",\r\n      \"‖\": \"major-group\",\r\n      \".\": \"syllable-break\",\r\n      \"‿\": \"linking\"\r\n    },\r\n    \"tone-step\": {\r\n      \"ꜜ\": \"downstep\",\r\n      \"ꜛ\": \"upstep\"\r\n    },\r\n    \"intonation\": {\r\n      \"↗\": \"global-rise\",\r\n      \"↘\": \"global-fall\"\r\n    }\r\n  }\r\n}");
    for (let type in supra["diacritic"]) {
      let bundle = supra["diacritic"][type];
      for (let key in bundle) {
        mapper.addDiacritic(key, type, bundle[key]);
      }
    }
    for (let key in supra["tone-letter"]) {
      mapper.addToneLetter(key, supra["tone-letter"][key]);
    }
    for (let supraType in supra["single-char"]) {
      let bundle = supra["single-char"][supraType];
      for (let key in bundle) {
        mapper.addSupra(key, supraType, bundle[key]);
      }
    }
    return new IpaParser(mapper, normalization);
  }
}
},{"./constants":12,"./ipa-parser":18,"./mapper":19}],18:[function(require,module,exports){
var IpaSyntaxError = require("./error/ipa-syntax-error");
let UnitsBuilder = require("./builder/units-builder");

module.exports = class IpaParser {

  constructor(mapper, normalization) {
    this.mapper = mapper;
    this.normalization = normalization;
  }

  /**
  * @param {String} ipaString
  * @returns 
  */
  parse(ipaString) {

    if (typeof ipaString != 'string' && !(ipaString instanceof String)) {
      throw new TypeError("Input is not a string : " + ipaString);
    }

    // Replace character by the standards ones, like ligatures, diacrtics, etc.
    let normalized = this._normalize(ipaString);

    return this._parse(normalized);
  }

  /**
   * 
   * @param {String} input a 'IPA' string
   * @returns {String} 
   */
  _normalize(input) {
    let tmp = this._replaceAll(input, this.normalization);

    // Use the 'decompose' form of the letter with diacritic
    // except for C with cedilla
    tmp = tmp.normalize("NFD");
    tmp = tmp.replace(/\u0063\u0327/g, "\u00E7"); // LATIN SMALL LETTER C WITH CEDILLA

    return tmp;
  }

  /**
   * @param {String} normalized a 'IPA' normalized String 
   * @returns
   */
  _parse(normalized) {
    let builder = new UnitsBuilder();

    let transcriptionType = "none";
    let state = "INIT";
    for (let i = 0; i < normalized.length; i++) {
      let char = normalized[i];
      let symbol = this.mapper.get(char);

      switch (symbol.type) {
        // BRACKET MANAGEMENT
        case "bracket": {
          switch (state) {

            case "INIT": {
              if (!symbol.start) {
                throw new IpaSyntaxError("Unexpected close bracket without open bracket. Close bracket: " + char);
              }
              transcriptionType = symbol.start;
              state = "OPEN";
            }; break;

            case "OPEN": {
              if (!symbol.end) {
                throw new IpaSyntaxError("Unexpected open bracket after an other one. Second bracket: " + char);
              }
              if (symbol.end !== transcriptionType) {
                throw new IpaSyntaxError("Opening bracket do not match ending bracket. Ending bracket: " + char);
              }
              state = "CLOSE";
            }; break;

            case "CLOSE":
              throw new IpaSyntaxError("Unexpected bracket: " + char);
          }
        }; break;

        // SPACING MANAGEMENT
        case "spacing": {
          builder.spacing();
        }; break;

        // DATA MANAGEMENT
        default: {

          if (state == "CLOSE") {
            throw new IpaSyntaxError("Data after closing bracket. Data: " + char);
          } else if (state == "INIT") {
            state = "OPEN";
          }
          builder.add(symbol);
        }
      }

    }
    // End of input
    if (transcriptionType !== "none" && state == "OPEN") {
      throw new IpaSyntaxError("Closing bracket is mising");
    }
    let phonemes = builder.end();

    return {
      "type": transcriptionType,
      "units": phonemes
    };
  }

  _replaceAll(input, actions) {
    let tmp = input;
    for (let key in actions) {
      let regex = new RegExp(key, 'gu');
      tmp = tmp.replace(regex, actions[key]);
    }
    return tmp;
  }
}
},{"./builder/units-builder":9,"./error/ipa-syntax-error":15}],19:[function(require,module,exports){
var IpaCharacterError = require("./error/ipa-character-error");

module.exports = class Mapper {

    constructor() {
        this.map = {};
    }

    _add(unicode, ipa) {
        let previous = this.map[unicode];
        if (previous) {
            throw new Error("duplicate data for character " + unicode + " . Previous " + JSON.stringify(previous));
        }
        this.map[unicode] = ipa;
    }

    addTieBar(unicode) {
        this._add(unicode, { "type": "tie-bar" });
    }

    addVowel(unicode, height, backness, rounded) {
        let data = {
            "type": "vowel",
            "height": height,
            "backness": backness,
            "rounded": rounded,
        }
        this._add(unicode, data);
    }

    addConsonant(unicode, manner, places, voiced, lateral, nasal) {
        let data = {
            "type": "consonant",
            "places": places,
            "voiced": voiced,
            "lateral": lateral,
            "manner": manner,
            "nasal": nasal
        };
        this._add(unicode, data);
    }

    addDiacritic(unicode, type, label) {
        let data = {
            "type": "diacritic",
            "diacritic": {
                "type": type,
                "label": label
            }
        };
        this._add(unicode, data);
    }

    addBrackets(bracketType, unicodeStart, unicodeEnd) {
        if (unicodeStart == unicodeEnd) {
            let data = {
                "type": "bracket",
                "start": bracketType,
                "end": bracketType
            };
            this._add(unicodeStart, data);
        } else {
            this._add(unicodeStart, { "type": "bracket", "start": bracketType });
            this._add(unicodeEnd, { "type": "bracket", "end": bracketType });
        }
    }

    addSupra(unicode, supraType, label) {
        let data = {
            "type": "supra",
            "category": supraType,
            "value": label
        };
        this._add(unicode, data);
    }

    addToneLetter(unicode, label) {
        let data = {
            "type": "tone-letter",
            "label": label
        };
        this._add(unicode, data);
    }

    get(unicode) {
        if (/\s/.test(unicode)) {
            return { "type": "spacing" };
        }

        let data = this.map[unicode];
        if (!data) {
            throw new IpaCharacterError(unicode);
        }
        return data;
    }
}
},{"./error/ipa-character-error":13}],20:[function(require,module,exports){
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
},{"ipa-parser":16}]},{},[20]);
