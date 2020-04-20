import React, { useState, useEffect } from "react";
import { Flex, Box, IconButton, Label } from "theme-ui";

import AddMapButton from "./AddMapButton";
import ExpandMoreIcon from "../icons/ExpandMoreIcon";
import PanToolIcon from "../icons/PanToolIcon";
import BrushToolIcon from "../icons/BrushToolIcon";
import EraseToolIcon from "../icons/EraseToolIcon";
import UndoIcon from "../icons/UndoIcon";
import RedoIcon from "../icons/RedoIcon";
import GridOnIcon from "../icons/GridOnIcon";
import GridOffIcon from "../icons/GridOffIcon";

import colors, { colorOptions } from "../helpers/colors";

import MapMenu from "./MapMenu";
import EraseAllIcon from "../icons/EraseAllIcon";

function MapControls({
  onMapChange,
  onToolChange,
  selectedTool,
  disabledTools,
  onUndo,
  onRedo,
  undoDisabled,
  redoDisabled,
  brushColor,
  onBrushColorChange,
  onEraseAll,
  useBrushGridSnapping,
  onBrushGridSnappingChange,
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const subMenus = {
    brush: (
      <Box sx={{ width: "104px" }} p={1}>
        <Box
          sx={{
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
          }}
        >
          {colorOptions.map((color) => (
            <Box
              key={color}
              sx={{
                width: "25%",
                paddingTop: "25%",
                borderRadius: "50%",
                transform: "scale(0.75)",
                backgroundColor: colors[color],
                cursor: "pointer",
              }}
              onClick={() => onBrushColorChange(color)}
            >
              {brushColor === color && (
                <Box
                  sx={{
                    width: "100%",
                    height: "100%",
                    border: "2px solid white",
                    position: "absolute",
                    top: 0,
                    borderRadius: "50%",
                  }}
                />
              )}
            </Box>
          ))}
        </Box>
        <Box>
          <Label
            sx={{
              fontSize: 1,
              alignItems: "center",
              ":hover": { color: "primary", cursor: "pointer" },
              ":active": { color: "secondary" },
            }}
          >
            {useBrushGridSnapping ? (
              <IconButton
                aria-label="Disable Brush Grid Snapping"
                title="Disable Brush Grid Snapping"
                onClick={() => onBrushGridSnappingChange(false)}
              >
                <GridOnIcon />
              </IconButton>
            ) : (
              <IconButton
                aria-label="Enable Brush Grid Snapping"
                title="Enable Brush Grid Snapping"
                onClick={() => onBrushGridSnappingChange(true)}
              >
                <GridOffIcon />
              </IconButton>
            )}
            Grid Lock
          </Label>
        </Box>
      </Box>
    ),
    erase: (
      <Box p={1} pr={3}>
        <Label
          sx={{
            fontSize: 1,
            alignItems: "center",
            ":hover": { color: "primary", cursor: "pointer" },
            ":active": { color: "secondary" },
          }}
        >
          <IconButton
            aria-label="Erase All"
            title="Erase All"
            onClick={() => {
              onEraseAll();
              setCurrentSubmenu(null);
              setCurrentSubmenuOptions({});
            }}
          >
            <EraseAllIcon />
          </IconButton>
          Erase All
        </Label>
      </Box>
    ),
  };

  const [currentSubmenu, setCurrentSubmenu] = useState(null);
  const [currentSubmenuOptions, setCurrentSubmenuOptions] = useState({});

  function handleToolClick(event, tool) {
    if (tool !== selectedTool) {
      onToolChange(tool);
    } else if (subMenus[tool]) {
      const toolRect = event.target.getBoundingClientRect();
      setCurrentSubmenu(tool);
      setCurrentSubmenuOptions({
        // Align the right of the submenu to the left of the tool and center vertically
        left: `${toolRect.left - 16}px`,
        top: `${toolRect.bottom - toolRect.height / 2}px`,
        style: { transform: "translate(-100%, -50%)" },
      });
    }
  }

  // Detect when a tool becomes disabled and switch to to the pan tool
  useEffect(() => {
    if (disabledTools.includes(selectedTool)) {
      onToolChange("pan");
    }
  }, [selectedTool, disabledTools, onToolChange]);

  const divider = (
    <Box
      my={2}
      bg="text"
      sx={{ height: "2px", width: "24px", borderRadius: "2px", opacity: 0.5 }}
    ></Box>
  );
  return (
    <>
      <Flex
        sx={{
          position: "absolute",
          top: 0,
          right: 0,
          flexDirection: "column",
          alignItems: "center",
        }}
      >
        <IconButton
          aria-label={isExpanded ? "Hide Map Controls" : "Show Map Controls"}
          title={isExpanded ? "Hide Map Controls" : "Show Map Controls"}
          onClick={() => setIsExpanded(!isExpanded)}
          sx={{
            transform: `rotate(${isExpanded ? "0" : "180deg"})`,
            display: "block",
            backgroundColor: "overlay",
            borderRadius: "50%",
          }}
          m={2}
        >
          <ExpandMoreIcon />
        </IconButton>
        <Box
          sx={{
            flexDirection: "column",
            alignItems: "center",
            display: isExpanded ? "flex" : "none",
            backgroundColor: "overlay",
            borderRadius: "4px",
          }}
          p={2}
        >
          <AddMapButton onMapChange={onMapChange} />
          {divider}
          <IconButton
            aria-label="Pan Tool"
            title="Pan Tool"
            onClick={(e) => handleToolClick(e, "pan")}
            sx={{ color: selectedTool === "pan" ? "primary" : "text" }}
            disabled={disabledTools.includes("pan")}
          >
            <PanToolIcon />
          </IconButton>
          <IconButton
            aria-label="Brush Tool"
            title="Brush Tool"
            onClick={(e) => handleToolClick(e, "brush")}
            sx={{ color: selectedTool === "brush" ? "primary" : "text" }}
            disabled={disabledTools.includes("brush")}
          >
            <BrushToolIcon />
          </IconButton>
          <IconButton
            aria-label="Erase Tool"
            title="Erase Tool"
            onClick={(e) => handleToolClick(e, "erase")}
            sx={{ color: selectedTool === "erase" ? "primary" : "text" }}
            disabled={disabledTools.includes("erase")}
          >
            <EraseToolIcon />
          </IconButton>
          {divider}
          <IconButton
            aria-label="Undo"
            title="Undo"
            onClick={() => onUndo()}
            disabled={undoDisabled}
          >
            <UndoIcon />
          </IconButton>
          <IconButton
            aria-label="Redo"
            title="Redo"
            onClick={() => onRedo()}
            disabled={redoDisabled}
          >
            <RedoIcon />
          </IconButton>
        </Box>
      </Flex>
      <MapMenu
        isOpen={!!currentSubmenu}
        onRequestClose={() => {
          setCurrentSubmenu(null);
          setCurrentSubmenuOptions({});
        }}
        {...currentSubmenuOptions}
      >
        {currentSubmenu && subMenus[currentSubmenu]}
      </MapMenu>
    </>
  );
}

export default MapControls;
