import * as BABYLON from "babylonjs";

/**
 * Find the number facing up on a mesh instance of a dice
 * @param {Object} instance The dice instance
 */
export function getDiceInstanceRoll(instance) {
  let highestDot = -1;
  let highestLocator;
  for (let locator of instance.getChildTransformNodes()) {
    let dif = locator
      .getAbsolutePosition()
      .subtract(instance.getAbsolutePosition());
    let direction = dif.normalize();
    const dot = BABYLON.Vector3.Dot(direction, BABYLON.Vector3.Up());
    if (dot > highestDot) {
      highestDot = dot;
      highestLocator = locator;
    }
  }
  return parseInt(highestLocator.name.slice(12));
}

/**
 * Find the number facing up on a dice object
 * @param {Object} dice The Dice object
 */
export function getDiceRoll(dice) {
  let number = getDiceInstanceRoll(dice.instance);
  // If the dice is a d100 add the d10
  if (dice.type === "d100") {
    const d10Number = getDiceInstanceRoll(dice.d10Instance);
    // Both zero set to 100
    if (d10Number === 0 && number === 0) {
      number = 100;
    } else {
      number += d10Number;
    }
  } else if (dice.type === "d10" && number === 0) {
    number = 10;
  }
  return { type: dice.type, roll: number };
}
