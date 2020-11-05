import React, { useContext, useState, useEffect, useRef } from "react";
import { Image as KonvaImage, Group } from "react-konva";
import { useSpring, animated } from "react-spring/konva";
import useImage from "use-image";

import useDataSource from "../../helpers/useDataSource";
import useDebounce from "../../helpers/useDebounce";
import usePrevious from "../../helpers/usePrevious";
import * as Vector2 from "../../helpers/vector2";

import AuthContext from "../../contexts/AuthContext";
import MapInteractionContext from "../../contexts/MapInteractionContext";

import TokenStatus from "../token/TokenStatus";
import TokenLabel from "../token/TokenLabel";

import { tokenSources, unknownSource } from "../../tokens";

const snappingThreshold = 1 / 7;

function MapToken({
  token,
  tokenState,
  tokenSizePercent,
  onTokenStateChange,
  onTokenMenuOpen,
  onTokenDragStart,
  onTokenDragEnd,
  draggable,
  mapState,
  fadeOnHover,
  map,
}) {
  const { userId } = useContext(AuthContext);
  const {
    setPreventMapInteraction,
    mapWidth,
    mapHeight,
    stageScale,
  } = useContext(MapInteractionContext);

  const tokenSource = useDataSource(token, tokenSources, unknownSource);
  const [tokenSourceImage, tokenSourceStatus] = useImage(tokenSource);
  const [tokenAspectRatio, setTokenAspectRatio] = useState(1);

  useEffect(() => {
    if (tokenSourceImage) {
      setTokenAspectRatio(tokenSourceImage.width / tokenSourceImage.height);
    }
  }, [tokenSourceImage]);

  function handleDragStart(event) {
    const tokenGroup = event.target;
    const tokenImage = imageRef.current;

    if (token && token.category === "vehicle") {
      // Find all other tokens on the map
      const layer = tokenGroup.getLayer();
      const tokens = layer.find(".character");
      for (let other of tokens) {
        if (other === tokenGroup) {
          continue;
        }
        const otherRect = other.getClientRect();
        const otherCenter = {
          x: otherRect.x + otherRect.width / 2,
          y: otherRect.y + otherRect.height / 2,
        };
        if (tokenImage.intersects(otherCenter)) {
          // Save and restore token position after moving layer
          const position = other.absolutePosition();
          other.moveTo(tokenGroup);
          other.absolutePosition(position);
        }
      }
    }

    onTokenDragStart(event);
  }

  function handleDragMove(event) {
    const tokenGroup = event.target;
    // Snap to corners of grid
    if (map.snapToGrid) {
      const offset = Vector2.multiply(map.grid.inset.topLeft, {
        x: mapWidth,
        y: mapHeight,
      });
      const position = {
        x: tokenGroup.x() + tokenGroup.width() / 2,
        y: tokenGroup.y() + tokenGroup.height() / 2,
      };
      const gridSize = {
        x:
          (mapWidth *
            (map.grid.inset.bottomRight.x - map.grid.inset.topLeft.x)) /
          map.grid.size.x,
        y:
          (mapHeight *
            (map.grid.inset.bottomRight.y - map.grid.inset.topLeft.y)) /
          map.grid.size.y,
      };
      // Transform into offset space, round, then transform back
      const gridSnap = Vector2.add(
        Vector2.roundTo(Vector2.subtract(position, offset), gridSize),
        offset
      );
      const gridDistance = Vector2.length(Vector2.subtract(gridSnap, position));
      const minGrid = Vector2.min(gridSize);
      if (gridDistance < minGrid * snappingThreshold) {
        tokenGroup.x(gridSnap.x - tokenGroup.width() / 2);
        tokenGroup.y(gridSnap.y - tokenGroup.height() / 2);
      }
    }
  }

  function handleDragEnd(event) {
    const tokenGroup = event.target;

    const mountChanges = {};
    if (token && token.category === "vehicle") {
      const parent = tokenGroup.getParent();
      const mountedTokens = tokenGroup.find(".character");
      for (let mountedToken of mountedTokens) {
        // Save and restore token position after moving layer
        const position = mountedToken.absolutePosition();
        mountedToken.moveTo(parent);
        mountedToken.absolutePosition(position);
        mountChanges[mountedToken.id()] = {
          ...mapState.tokens[mountedToken.id()],
          x: mountedToken.x() / mapWidth,
          y: mountedToken.y() / mapHeight,
          lastModifiedBy: userId,
          lastModified: Date.now(),
        };
      }
    }

    setPreventMapInteraction(false);
    onTokenStateChange({
      ...mountChanges,
      [tokenState.id]: {
        ...tokenState,
        x: tokenGroup.x() / mapWidth,
        y: tokenGroup.y() / mapHeight,
        lastModifiedBy: userId,
        lastModified: Date.now(),
      },
    });
    onTokenDragEnd(event);
  }

  function handleClick(event) {
    if (draggable) {
      const tokenImage = event.target;
      onTokenMenuOpen(tokenState.id, tokenImage);
    }
  }

  const [tokenOpacity, setTokenOpacity] = useState(1);
  // Store token pointer down time to check for a click when token is locked
  const tokenPointerDownTimeRef = useRef();
  function handlePointerDown(event) {
    if (draggable) {
      setPreventMapInteraction(true);
    }
    if (tokenState.locked && map.owner === userId) {
      tokenPointerDownTimeRef.current = event.evt.timeStamp;
    }
  }

  function handlePointerUp(event) {
    if (draggable) {
      setPreventMapInteraction(false);
    }
    // Check token click when locked and we are the map owner
    // We can't use onClick because that doesn't check pointer distance
    if (tokenState.locked && map.owner === userId) {
      // If down and up time is small trigger a click
      const delta = event.evt.timeStamp - tokenPointerDownTimeRef.current;
      if (delta < 300) {
        const tokenImage = event.target;
        onTokenMenuOpen(tokenState.id, tokenImage);
      }
    }
  }

  function handlePointerEnter() {
    if (fadeOnHover) {
      setTokenOpacity(0.5);
    }
  }

  function handlePointerLeave() {
    if (tokenOpacity !== 1.0) {
      setTokenOpacity(1.0);
    }
  }

  const tokenWidth = tokenSizePercent * mapWidth * tokenState.size;
  const tokenHeight =
    tokenSizePercent * (mapWidth / tokenAspectRatio) * tokenState.size;

  const debouncedStageScale = useDebounce(stageScale, 50);
  const imageRef = useRef();
  useEffect(() => {
    const image = imageRef.current;
    if (
      image &&
      tokenSourceStatus === "loaded" &&
      tokenWidth > 0 &&
      tokenHeight > 0
    ) {
      image.cache({
        pixelRatio: debouncedStageScale * window.devicePixelRatio,
      });
      image.drawHitFromCache();
      // Force redraw
      image.getLayer().draw();
    }
  }, [debouncedStageScale, tokenWidth, tokenHeight, tokenSourceStatus]);

  // Animate to new token positions if edited by others
  const tokenX = tokenState.x * mapWidth;
  const tokenY = tokenState.y * mapHeight;
  const previousWidth = usePrevious(mapWidth);
  const previousHeight = usePrevious(mapHeight);
  const resized = mapWidth !== previousWidth || mapHeight !== previousHeight;
  const skipAnimation = tokenState.lastModifiedBy === userId || resized;
  const props = useSpring({
    x: tokenX,
    y: tokenY,
    immediate: skipAnimation,
  });

  // When a token is hidden if you aren't the map owner hide it completely
  if (map && !tokenState.visible && map.owner !== userId) {
    return null;
  }

  // Token name is used by on click to find whether a token is a vehicle or prop
  let tokenName = "";
  if (token) {
    tokenName = token.category;
  }
  if (tokenState && tokenState.locked) {
    tokenName = tokenName + "-locked";
  }

  return (
    <animated.Group
      {...props}
      width={tokenWidth}
      height={tokenHeight}
      draggable={draggable}
      onMouseDown={handlePointerDown}
      onMouseUp={handlePointerUp}
      onMouseEnter={handlePointerEnter}
      onMouseLeave={handlePointerLeave}
      onTouchStart={handlePointerDown}
      onTouchEnd={handlePointerUp}
      onClick={handleClick}
      onTap={handleClick}
      onDragEnd={handleDragEnd}
      onDragStart={handleDragStart}
      onDragMove={handleDragMove}
      opacity={tokenState.visible ? tokenOpacity : 0.5}
      name={tokenName}
      id={tokenState.id}
    >
      <KonvaImage
        ref={imageRef}
        width={tokenWidth}
        height={tokenHeight}
        x={0}
        y={0}
        image={tokenSourceImage}
        rotation={tokenState.rotation}
        offsetX={tokenWidth / 2}
        offsetY={tokenHeight / 2}
      />
      <Group offsetX={tokenWidth / 2} offsetY={tokenHeight / 2}>
        <TokenStatus
          tokenState={tokenState}
          width={tokenWidth}
          height={tokenHeight}
        />
        <TokenLabel
          tokenState={tokenState}
          width={tokenWidth}
          height={tokenHeight}
        />
      </Group>
    </animated.Group>
  );
}

export default MapToken;