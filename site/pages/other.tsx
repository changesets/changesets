import React from "react";
/** @jsx jsx */
import { jsx } from "@emotion/core";
import { PropTypes } from "magical-types/macro";
import Textfield from "@design-system/textfield";

export default () => {
  return (
    <div css={{ fontFamily: "sans-serif" }}>
      something
      <PropTypes component={Textfield} />
    </div>
  );
};
