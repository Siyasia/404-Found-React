import React, { useState } from 'react';

export function DisplayAvatar({ invItems }) {

    const equipped = {};

    //create list of equipped items from the user to display
    for (const invItem of invItems) {
        if (invItem.equipped) {
            equipped[invItem.placement] = invItem;
        }
    }

    return (
        //positioning the images on top of each other
        <div style={{
            position: 'relative',
            width: '180px',
            height: '240px'
        }} >

            {/* base image for clothes to be layered on */}
            <img src='images/base.png' style={layer} />
            
            {/* from bottom-most to top-most layers */}
            {equipped.shoes && <img src={`/images/${equipped.shoes.name}full.png`} style={layer} />}
            {equipped.pants && <img src={`/images/${equipped.pants.name}full.png`} style={layer} />}
            {equipped.shirt && <img src={`/images/${equipped.shirt.name}full.png`} style={layer} />}
            {equipped.hair && <img src={`/images/${equipped.hair.name}full.png`} style={layer} />}
            {equipped.accessory && <img src={`/images/${equipped.accessory.name}full.png`} style={layer} />}

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