import React from 'react';
import misviLogo from '../assets/images/regenerated_image_1791035363792.png';

interface MisviLogoProps {
  className?: string;
  height?: number | string;
}

export const MisviLogo: React.FC<MisviLogoProps> = ({ className = 'h-11 sm:h-13 w-auto', height }) => {
  return (
    <div className={`inline-flex items-center ${className}`} style={height ? { height } : undefined}>
      <img
        src={misviLogo}
        alt="MISVI - Going For Unique Choice..."
        className="h-full w-auto object-contain"
      />
    </div>
  );
};

export default MisviLogo;
