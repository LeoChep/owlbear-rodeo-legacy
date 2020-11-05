import React, { useContext } from "react";

import AuthContext from "../../contexts/AuthContext";
import MapInteractionContext from "../../contexts/MapInteractionContext";

import DragOverlay from "../DragOverlay";

function TokenDragOverlay({
  onTokenStateRemove,
  onTokenStateChange,
  token,
  tokenState,
  tokenGroup,
  dragging,
  mapState,
}) {
  const { userId } = useContext(AuthContext);
  const { mapWidth, mapHeight } = useContext(MapInteractionContext);

  function handleTokenRemove() {
    // Handle other tokens when a vehicle gets deleted
    if (token && token.category === "vehicle") {
      const layer = tokenGroup.getLayer();
      const mountedTokens = tokenGroup.find(".token");
      for (let mountedToken of mountedTokens) {
        // Save and restore token position after moving layer
        const position = mountedToken.absolutePosition();
        mountedToken.moveTo(layer);
        mountedToken.absolutePosition(position);
        onTokenStateChange({
          [mountedToken.id()]: {
            ...mapState.tokens[mountedToken.id()],
            x: mountedToken.x() / mapWidth,
            y: mountedToken.y() / mapHeight,
            lastModifiedBy: userId,
            lastModified: Date.now(),
          },
        });
      }
    }
    onTokenStateRemove(tokenState);
  }

  return (
    <DragOverlay
      dragging={dragging}
      onRemove={handleTokenRemove}
      node={tokenGroup}
    />
  );
}

export default TokenDragOverlay;