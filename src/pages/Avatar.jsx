import React from 'react';
import { DisplayAvatar } from '../components/DisplayAvatar.jsx';
import { useGameProfile } from '../components/useGameProfile.jsx';
import { useItems } from '../components/useItems.jsx';
import { useInventory } from '../components/useInventory.jsx';

export default function Avatar() {

    const { profile, saveProfile, loading, error } = useGameProfile();
    const { items, loading: itemLoading, error: itemError } = useItems();
    const invItems = useInventory(profile, items);

    if (loading || itemLoading) return <p>Loading...</p>;

    const equip = (itemID, placement) => {
        //create "updated inventory" and search through inventory items
        const updated = profile.inventory.map(inv => {
            //if item id matches, equip item
            if (inv.id === itemID) {
                return { ...inv, equipped: true};
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
        //create updated inventory
        const updated = profile.inventory.map(inv =>
            //unequip item
            inv.id === itemID ? { ...inv, equipped: false } : inv
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

                    {Object.entries(categories).map(([placement, categoryItems]) => (
                        <div key={placement} className='card' style= {{ marginBottom: '1rem', padding: '1rem' }}>
                            <h3 style={{ marginTop: 0 }}>
                                {placement.charAt(0).toUpperCase() + placement.slice(1)}
                            </h3>

                            <div style={{
                                display: 'flex',
                                gap: '1rem',
                                flexWrap: 'wrap'
                            }}>

                                {categoryItems.map(item =>
                                    <div key={item.id} style={{
                                        border: item.equipped ? '2px solid gold' : '1px solid #ccc',
                                        padding: '0.5rem',
                                        textAlign: 'center',
                                        width: '100px'
                                    }}>

                                        <img src={item.path} style={{
                                            width: '75px',
                                            height: '75px',
                                            objectFit: 'contain'
                                        }}/>

                                        {item.equipped ? (
                                            <button className='btn' onClick={() => unequip(item.id)} style={{ marginTop: '0.4rem', width: '100%'}}>
                                                Unequip
                                            </button>
                                        ) : (
                                            <button className='btn' onClick={() => equip(item.id, item.placement)} style={{ marginTop: '0.4rem', width: '100%'}}>
                                                Equip
                                            </button>                                            
                                        )}

                                    </div>
                                )}

                            </div>

                        </div>
                    ))}

                </div>

            </div>

        </section>
    )

}
