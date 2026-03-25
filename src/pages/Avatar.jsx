import React, { useState } from 'react';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';
import { useGameProfile } from '../components/useGameProfile.jsx';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';

export default function Avatar() {

    const { profile, saveProfile, loading, error } = useGameProfile();
    const { items, loading: itemLoading, error: itemError } = useItems();
    const invItems = useInventory(profile, items);
    const [selectedCategory, setSelectedCategory] = React.useState('Base'); 
    const COLOR_MAP = {
        Base: {
            1: '#BD894E',
            2: '#D8AE73',
            3: '#EAC487',
            4: '#F9DCB2',
            5: '#E5B696',
            6: '#E9BAA6',
            7: '#F6B889',
            8: '#D89C70',
            9: '#A77F61',
            10: '#B1815E',
            11: '#85582E',
            12: '#976641',
            13: '#6E513B',
            14: '#68462D',
            15: '#4B2F1A',
            16: '#532A0B',
            17: '#693E1E',
            18: '#734E32',
            19: '#9D96E5',
            20: '#233F8A',
            21: '#693AA1',
            22: '#D87BB7',
            23: '#7BD887',
            24: '#40AB8E'
        },
        Hair: {
            1: '#2A2828',
            2: '#E1EAEA',
            3: '#DB5B4C',
            4: '#E66695',
            5: '#CE68D1',
            6: '#9343DD',
            7: '#4643DD',
            8: '#4398DD',
            9: '#43DBDD',
            10: '#43DD7C',
            11: '#A8DD43',
            12: '#F0DC71',
            13: '#DD8642',
            14: '#BE3F3C',
            15: '#825929',
            16: '#B0A56B',
            17: '#55330A'
        },
        Eyebrows: null,
        Shirts: {
            1: '#2A2828',
            2: '#E1EAEA',
            3: '#DB5B4C',
            4: '#E66695',
            5: '#CE68D1',
            6: '#9343DD',
            7: '#4643DD',
            8: '#4398DD',
            9: '#43DBDD',
            10: '#43DD7C',
            11: '#A8DD43',
            12: '#F0DC71',
            13: '#DD8642',
            14: '#BE3F3C',
            15: '#55330A'
        },
        Outerwear: null,
        Eyes: {
            1: '#2A2828',
            2: '#E1EAEA',
            3: '#DB5B4C',
            4: '#E66695',
            5: '#CE68D1',
            6: '#9343DD',
            7: '#4643DD',
            8: '#4398DD',
            9: '#43DBDD',
            10: '#43DD7C',
            11: '#A8DD43',
            12: '#F0DC71',
            13: '#DD8642',
            14: '#BE3F3C',
            15: '#825929',
            16: '#55330A'
        }
    }
    COLOR_MAP.Eyebrows = COLOR_MAP.Hair;
    COLOR_MAP.Outerwear = COLOR_MAP.Shirts;

    if (loading || itemLoading) return <p>Loading...</p>;

    const equip = (itemID, placement) => {
        //create "updated inventory" and search through inventory items
        const updated = profile.inventory.map(inv => {
            //if item id matches, equip item
            if (inv.id === itemID) {
                return { ...inv, equipped: true };
            }
            //if item id does not match but the placement does, unequip
            const item = items.find(i => i.id === inv.id);
            if (item?.placement === placement) {
                return { ...inv, equipped: false};
            }
            return inv;
        });
        //update the profile with same id/coins and new updated inventory
        saveProfile({ ...profile, inventory: updated});
    };

    //unequip an item
    const unequip = (itemID) => {

        //find item to be unequipped in inventory
        const invItem = profile.inventory.find(i => i.id === itemID);
        if (!invItem) return;

        const item = items.find(i => i.id === invItem.id);
        if (!item) return;

        //find the default item for the placement unequipping
        const defaultItem = items.find( i=> i.type === 'Default' && i.placement === item.placement);
        if (!defaultItem) return;

        //prevent user from unequipping a default item
        if (invItem.id === defaultItem.id) return;

        //unequip item
        let updated = profile.inventory.map(inv => {
            //unequip the current item
            if (inv.id === itemID) {
                return { ...inv, equipped: false};
            }
            //equip the default item with same color
            if (inv.id === defaultItem.id) {
                return { ...inv, equipped: true, color: inv.color ?? 1};
            }
            return inv;
        });

        saveProfile({ ...profile, inventory: updated });
    };

    const updateColor = (itemID, color) => {

        const updated = profile.inventory.map(inv =>
            inv.id === itemID ? { ...inv, color } : inv
        );
        saveProfile({ ...profile, inventory: updated });

    };

    //used for displaying inventory by item placement
    const categories = {};
    for (const item of invItems) {
        if (!categories[item.placement]) {
            categories[item.placement] = [];
        }
        categories[item.placement].push(item);
    };

    return (
        <section className='container'>

            <h1>Customize Avatar</h1>
            <div style= {{
                display: 'grid',
                gridTemplateColumns: '220px 1fr',
                gap: '2rem',
                alignItems: 'start'
            }}>

                <div className='card' style={{
                    padding: '1.5rem',
                    textAlign: 'center'
                }}>
                    <DisplayAvatar invItems={invItems} />
                </div>

                <div>
                    <div style={{ display: 'flex', gap: '.5rem', marginBottom: '1rem' }}>
                        {Object.keys(categories).map(placement => (
                            <button
                                key={placement}
                                onClick={() => setSelectedCategory(placement)}
                                style={{
                                    padding: '.4rem .8rem',
                                    backgroundColor: selectedCategory === placement ? 'gold' : '#eee',
                                    border: '1px solid #999',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                {placement.charAt(0).toUpperCase() + placement.slice(1)}
                            </button>
                        ))}
                    </div>

                <div className='card' style={{ marginBottom: '1rem', padding: '1rem' }}>
                    <h3 style={{ marginTop: 0 }}>
                        {selectedCategory.charAt(0).toUpperCase() + selectedCategory.slice(1)}
                    </h3>

                    <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
                        {categories[selectedCategory]?.map(item => {
                            const isDefault = item.type === 'Default';

                            return (
                                <div key={item.id} style={{
                                    border: item.equipped ? '2px solid gold' : '1px solid #ccc',
                                    padding: '0.5rem',
                                    textAlign: 'center',
                                    width: '100px'
                                }}>
                                    <img src={`${item.path}.PNG`} style={{ width: '75px', height: '75px', objectFit: 'contain' }} />

                                    {item.equipped && COLOR_MAP[item.placement] && (
                                        <div style={{
                                            display: 'flex',
                                            gap: '4px',
                                            flexWrap: 'wrap',
                                            justifyContent: 'center',
                                            marginTop: '0.3rem'
                                        }}>
                                            {Object.entries(COLOR_MAP[item.placement]).map(([color, hex]) => (
                                                <button
                                                    key={color}
                                                    onClick={() => updateColor(item.id, parseInt(color))}
                                                    style={{
                                                        width: '16px',
                                                        height: '16px',
                                                        backgroundColor: hex,
                                                        border: (item.color ?? 1) === parseInt(color) ? '2px solid black' : '1px solid #999',
                                                        cursor: 'pointer',
                                                        padding: '0'
                                                    }}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    {item.equipped ? (
                                        !isDefault && (
                                            <button className='btn' onClick={() => unequip(item.id)} style={{ marginTop: '0.4rem', width: '100%' }}>
                                                Unequip
                                            </button>
                                        )
                                    ) : (
                                        <button className='btn' onClick={() => equip(item.id, item.placement)} style={{ marginTop: '0.4rem', width: '100%' }}>
                                            Equip
                                        </button>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

            </div>
            </div>

        </section>
    )

}
