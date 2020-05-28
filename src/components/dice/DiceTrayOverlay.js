import React, {
  useRef,
  useCallback,
  useEffect,
  useContext,
  useState,
} from "react";
import * as BABYLON from "babylonjs";
import { Box } from "theme-ui";

import environment from "../../dice/environment.dds";

import DiceInteraction from "./DiceInteraction";
import DiceControls from "./DiceControls";
import Dice from "../../dice/Dice";
import LoadingOverlay from "../LoadingOverlay";

import DiceTray from "../../dice/diceTray/DiceTray";

import DiceLoadingContext from "../../contexts/DiceLoadingContext";

function DiceTrayOverlay({ isOpen }) {
  const sceneRef = useRef();
  const shadowGeneratorRef = useRef();
  const diceRefs = useRef([]);
  const sceneVisibleRef = useRef(false);
  const sceneInteractionRef = useRef(false);
  // Add to the counter to ingore sleep values
  const sceneKeepAwakeRef = useRef(0);
  const diceTrayRef = useRef();

  const [diceTraySize, setDiceTraySize] = useState("single");
  const { assetLoadStart, assetLoadFinish, isLoading } = useContext(
    DiceLoadingContext
  );

  function handleAssetLoadStart() {
    assetLoadStart();
    sceneKeepAwakeRef.current++;
  }

  function handleAssetLoadFinish() {
    assetLoadFinish();
    sceneKeepAwakeRef.current--;
  }

  // Force render when loading assets
  useEffect(() => {
    if (isLoading) {
      sceneKeepAwakeRef.current++;
    }
    return () => {
      if (isLoading) {
        // eslint-disable-next-line react-hooks/exhaustive-deps
        sceneKeepAwakeRef.current--;
      }
    };
  }, [isLoading]);

  // Forces rendering for 1 second
  function forceRender() {
    // Force rerender
    sceneKeepAwakeRef.current++;
    let triggered = false;
    let timeout = setTimeout(() => {
      sceneKeepAwakeRef.current--;
      triggered = true;
    }, 1000);

    return () => {
      clearTimeout(timeout);
      if (!triggered) {
        sceneKeepAwakeRef.current--;
      }
    };
  }

  // Force render when changing dice tray size
  useEffect(() => {
    const diceTray = diceTrayRef.current;
    let cleanup;
    if (diceTray) {
      diceTray.size = diceTraySize;
      cleanup = forceRender();
    }
    return cleanup;
  }, [diceTraySize]);

  useEffect(() => {
    let cleanup;
    if (isOpen) {
      sceneVisibleRef.current = true;
      cleanup = forceRender();
    } else {
      sceneVisibleRef.current = false;
    }

    return cleanup;
  }, [isOpen]);

  const handleSceneMount = useCallback(async ({ scene, engine }) => {
    sceneRef.current = scene;
    await initializeScene(scene);
    engine.runRenderLoop(() => update(scene));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function initializeScene(scene) {
    handleAssetLoadStart();
    let light = new BABYLON.DirectionalLight(
      "DirectionalLight",
      new BABYLON.Vector3(-0.5, -1, -0.5),
      scene
    );
    light.position = new BABYLON.Vector3(5, 10, 5);
    light.shadowMinZ = 1;
    light.shadowMaxZ = 50;
    let shadowGenerator = new BABYLON.ShadowGenerator(1024, light);
    shadowGenerator.useCloseExponentialShadowMap = true;
    shadowGenerator.darkness = 0.7;
    shadowGeneratorRef.current = shadowGenerator;

    scene.environmentTexture = BABYLON.CubeTexture.CreateFromPrefilteredData(
      environment,
      scene
    );
    scene.environmentIntensity = 1.0;

    let diceTray = new DiceTray("single", scene, shadowGenerator);
    await diceTray.load();
    diceTrayRef.current = diceTray;
    handleAssetLoadFinish();
  }

  function update(scene) {
    function getDiceSpeed(dice) {
      const diceSpeed = dice.instance.physicsImpostor
        .getLinearVelocity()
        .length();
      // If the dice is a d100 check the d10 as well
      if (dice.type === "d100") {
        const d10Speed = dice.d10Instance.physicsImpostor
          .getLinearVelocity()
          .length();
        return Math.max(diceSpeed, d10Speed);
      } else {
        return diceSpeed;
      }
    }

    const die = diceRefs.current;
    const sceneVisible = sceneVisibleRef.current;
    if (!sceneVisible) {
      return;
    }
    const forceSceneRender = sceneKeepAwakeRef.current > 0;
    const sceneInteraction = sceneInteractionRef.current;
    const diceAwake = die.map((dice) => dice.asleep).includes(false);
    // Return early if scene doesn't need to be re-rendered
    if (!forceSceneRender && !sceneInteraction && !diceAwake) {
      return;
    }

    for (let i = 0; i < die.length; i++) {
      const dice = die[i];
      const speed = getDiceSpeed(dice);
      // If the speed has been below 0.01 for 1s set dice to sleep
      if (speed < 0.01 && !dice.sleepTimout) {
        dice.sleepTimout = setTimeout(() => {
          dice.asleep = true;
        }, 1000);
      } else if (speed > 0.5 && (dice.asleep || dice.sleepTimout)) {
        dice.asleep = false;
        clearTimeout(dice.sleepTimout);
        dice.sleepTimout = null;
      }
    }

    if (scene) {
      scene.render();
    }
  }

  function handleDiceAdd(style, type) {
    const scene = sceneRef.current;
    const shadowGenerator = shadowGeneratorRef.current;
    if (scene && shadowGenerator) {
      const instance = style.createInstance(type, scene);
      shadowGenerator.addShadowCaster(instance);
      Dice.roll(instance);
      let dice = { type, instance, asleep: false };
      // If we have a d100 add a d10 as well
      if (type === "d100") {
        const d10Instance = style.createInstance("d10", scene);
        shadowGenerator.addShadowCaster(d10Instance);
        Dice.roll(d10Instance);
        dice.d10Instance = d10Instance;
      }
      diceRefs.current.push(dice);
    }
  }

  function handleDiceClear() {
    const die = diceRefs.current;
    for (let dice of die) {
      dice.instance.dispose();
      if (dice.type === "d100") {
        dice.d10Instance.dispose();
      }
    }
    diceRefs.current = [];
    forceRender();
  }

  function handleDiceReroll() {
    const die = diceRefs.current;
    for (let dice of die) {
      Dice.roll(dice.instance);
      if (dice.type === "d100") {
        Dice.roll(dice.d10Instance);
      }
      dice.asleep = false;
    }
  }

  async function handleDiceLoad(dice) {
    handleAssetLoadStart();
    const scene = sceneRef.current;
    if (scene) {
      await dice.class.load(scene);
    }
    handleAssetLoadFinish();
  }

  return (
    <Box
      sx={{
        width: diceTraySize === "single" ? "500px" : "1000px",
        maxWidth:
          diceTraySize === "single"
            ? "calc(50vh - 48px)"
            : "calc(100vh - 64px)",
        paddingBottom: diceTraySize === "single" ? "200%" : "100%",
        borderRadius: "4px",
        display: isOpen ? "block" : "none",
        position: "relative",
        overflow: "hidden",
        pointerEvents: "all",
      }}
      bg="background"
    >
      <DiceInteraction
        onSceneMount={handleSceneMount}
        onPointerDown={() => {
          sceneInteractionRef.current = true;
        }}
        onPointerUp={() => {
          sceneInteractionRef.current = false;
        }}
      />
      <DiceControls
        diceRefs={diceRefs}
        sceneVisibleRef={sceneVisibleRef}
        onDiceAdd={handleDiceAdd}
        onDiceClear={handleDiceClear}
        onDiceReroll={handleDiceReroll}
        onDiceLoad={handleDiceLoad}
        diceTraySize={diceTraySize}
        onDiceTraySizeChange={setDiceTraySize}
      />
      {isLoading && <LoadingOverlay />}
    </Box>
  );
}

export default DiceTrayOverlay;
