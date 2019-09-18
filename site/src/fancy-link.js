import React from "react";
import { Link } from "gatsby";
import colors from "./colors";

export let LinksContainer = props => (
  <div
    css={{ display: "flex", justifyContent: "center", alignItems: "center" }}
    {...props}
  />
);

let fancyCSS = {
  display: "block",
  color: "inherit",
  textDecoration: "none",
  fontWeight: "bold",
  paddingLeft: 32,
  paddingRight: 32,
  paddingTop: 8,
  paddingBottom: 8,
  marginLeft: 8,
  marginRight: 8,
  border: `${colors.base} solid 4px`,
  borderRadius: 8,
  ":hover": {
    backgroundColor: colors.base,
    color: "white"
  }
};

export let FancyLink = props => <Link css={fancyCSS} {...props} />;
export let FancyAnchor = props => <a css={fancyCSS} {...props} />;
