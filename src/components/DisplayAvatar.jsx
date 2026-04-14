import React, { useState } from 'react';

export function DisplayAvatar({ invItems }) {

    const equipped = {};

    //create list of equipped items from the user to display
    for (const invItem of invItems) {
        if (invItem.equipped) {
            equipped[invItem.placement.toLowerCase()] = invItem;
        }
    }

    return (
        //positioning the images on top of each other
        <div style={{
            position: 'relative',
            width: '180px',
            height: '240px'
        }} >
            
            {/* from bottom-most to top-most layers */}
            {equipped.base && <img src={`${equipped.base.path}${equipped.base.color ?? 1}.PNG`} style={layer} />}
            {equipped.hair && <img src={`${equipped.hair.path}-${equipped.hair.color ?? 1}full.PNG`} style={layer} />}
            {equipped.eyebrows && <img src={`${equipped.eyebrows.path}-${equipped.eyebrows.color ?? 1}full.PNG`} style={layer} />}
            {equipped.eyes && <img src={`${equipped.eyes.path}-${equipped.eyes.color ?? 1}full.PNG`} style={layer} />}
            {equipped.mouths && <img src={`${equipped.mouths.path}full.PNG`} style={layer} />}
            {equipped.shoes && <img src={`${equipped.shoes.path}-${equipped.shoes.color ?? 1}full.PNG`} style={layer} />}
            {equipped.pants && <img src={`${equipped.pants.path}-${equipped.pants.color ?? 1}full.PNG`} style={layer} />}
            {equipped.shirts && <img src={`${equipped.shirts.path}-${equipped.shirts.color ?? 1}full.PNG`} style={layer} />}
            {equipped.outerwear && <img src={`${equipped.outerwear.path}-${equipped.outerwear.color ?? 1}full.PNG`} style={layer} />}

        </div>
    );
}

//defines the styling for layering images on top of each other
const layer = {
    position: 'absolute',
    top: 0,
    left: 0,
    width: '180px',
    height: '240px',
    objectFit: 'contain'
}
