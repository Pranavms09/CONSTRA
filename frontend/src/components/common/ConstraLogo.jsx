import React from "react";
import logoPng from "../../assets/constra-logo.png";

export const ConstraLogo = ({ className = "w-7 h-7", alt = "CONSTRA Logo" }) => {
  return (
    <img
      src={logoPng}
      alt={alt}
      className={`object-contain shrink-0 ${className}`}
      loading="eager"
    />
  );
};

export default ConstraLogo;
