import {
    eventSource,
    event_types,
    saveSettingsDebounced
} from '../../../../script.js';

import { 
    getContext,
    extension_settings,
    loadExtensionSettings
} from '../../../extensions.js'; 

import {
    characters, 
    this_chid,
    getThumbnailUrl
} from '../../../../script.js';

import {
    user_avatar
} from '../../../personas.js';

const extensionName = 'AvatarPopups';
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;
const DEFAULT_AVATAR_PATH = '/img/five.png'; 


let currentEditingStickerPopupId = null; 

let stickerPanelPos = { top: -1, left: -1 }; 
let currentEditingAvatarType = null; 
let avatarPanelPos = { top: -1, left: -1 }; 
let isAvatarDragging = false; 




const DEFAULT_SETTINGS = {
    enabled: true,
    ignoreClick: false, 
    autoPosAdjust: false, 
    isFloating: false, 
    
    
    ignoreCharClick: false,
    ignoreStickerClick: false,
    
    
    initialViewport: { width: window.innerWidth, height: window.innerHeight },

    charPos: { top: 20, left: 20 },
    personaPos: { top: 20, left: 800 },
    
    charConfig: { 
        width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } 
    },
    personaConfig: { 
        width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } 
    },
    
    stickerCounter: 0,
    savedStickers: [], 
    
    activeStickers: [], 
    
    presets: {
        '기본 설정': { 
            
            charPos: { top: 20, left: 20 },
            personaPos: { top: 20, left: 800 },
            
            charConfig: { width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } }, 
            personaConfig: { width: 250, height: 350, rotation: 0, imageOverride: '', shape: 'square', imageAdjust: { x: 0, y: 0, zoom: 1.1, rotation: 0 } }, 
            activeStickers: []
        }
    }
};

let settings = extension_settings[extensionName];
if (!settings || Object.keys(settings).length === 0) {
    settings = Object.assign({}, DEFAULT_SETTINGS);
    extension_settings[extensionName] = settings;
    saveSettingsDebounced();
} else {
    
    settings = Object.assign({}, DEFAULT_SETTINGS, settings);
    settings.charConfig = Object.assign({}, DEFAULT_SETTINGS.charConfig, settings.charConfig);
    settings.personaConfig = Object.assign({}, DEFAULT_SETTINGS.personaConfig, settings.personaConfig);
    settings.presets = Object.assign({}, DEFAULT_SETTINGS.presets, settings.presets);
    settings.charConfig.imageAdjust = Object.assign({}, DEFAULT_SETTINGS.charConfig.imageAdjust, settings.charConfig.imageAdjust);
    settings.personaConfig.imageAdjust = Object.assign({}, DEFAULT_SETTINGS.personaConfig.imageAdjust, settings.personaConfig.imageAdjust);
    
    
    if (Array.isArray(settings.activeStickers)) {
        settings.activeStickers.forEach(sticker => {
            if (sticker.isFlipped === undefined) {
                sticker.isFlipped = false;
            }
            if (sticker.zIndex === undefined) {
                sticker.zIndex = 1000; 
            }
        });
    }

    extension_settings[extensionName] = settings;
}



function adjustPosBasedOnViewport() {
    if (!settings.autoPosAdjust) return; 

    const currentWidth = window.innerWidth;
    const currentHeight = window.innerHeight;
    const initialWidth = settings.initialViewport.width;
    const initialHeight = settings.initialViewport.height;

    
    if (initialWidth === 0 || initialHeight === 0) return;

    
    const newCharLeft = settings.charPos.left * (currentWidth / initialWidth);
    const newCharTop = settings.charPos.top * (currentHeight / initialHeight);
    
    $('#char-avatar-popup').css({
        left: `${newCharLeft}px`,
        top: `${newCharTop}px`
    });
    
    
    const newPersonaLeft = settings.personaPos.left * (currentWidth / initialWidth);
    const newPersonaTop = settings.personaPos.top * (currentHeight / initialHeight);

    $('#persona-avatar-popup').css({
        left: `${newPersonaLeft}px`,
        top: `${newPersonaTop}px`
    });
    
    
    

    
    settings.activeStickers.forEach(activeSticker => {
        const $stickerPopup = $(`#${activeSticker.popupId}`);
        if ($stickerPopup.length) {
            
            const newStickerLeft = activeSticker.left * (currentWidth / initialWidth);
            const newStickerTop = activeSticker.top * (currentHeight / initialHeight);

            $stickerPopup.css({
                left: `${newStickerLeft}px`,
                top: `${newStickerTop}px`
            });
        }
    });
}




let resizeTimer;
const resizeHandler = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
        adjustPosBasedOnViewport();
    }, 100); 
};


function startAutoPosAdjustment() {
    if (!settings.autoPosAdjust) return;
    
    
    settings.initialViewport = {
        width: window.innerWidth,
        height: window.innerHeight
    };
    
    
    $(window).on('resize.AvatarPopups', resizeHandler);
    
    
    adjustPosBasedOnViewport();
    
    saveSettingsDebounced(); 
}


function stopAutoPosAdjustment() {
    $(window).off('resize.AvatarPopups');
}


function toggleFloating(isEnabled) {
    const $charPopup = $('#char-avatar-popup');
    const $personaPopup = $('#persona-avatar-popup');

    if (isEnabled) {
        $charPopup.addClass('floating-char');
        $personaPopup.addClass('floating-persona');
    } else {
        $charPopup.removeClass('floating-char');
        $personaPopup.removeClass('floating-persona');
    }
}

function applyConfigToPopup(type) {
    const $popup = $(`#${type}-avatar-popup`);
    const $img = $popup.find('img');
    const config = settings[`${type}Config`];
    
    if (!$popup.length) return;

    let rotation = config.rotation || 0;
    
    const imgConfig = config.imageAdjust || { x: 0, y: 0, zoom: 1, rotation: 0 };
    const imgZoom = imgConfig.zoom || 1;
    const imgInnerRotation = imgConfig.rotation || 0;
    const moveX = imgConfig.x ?? 0;
    const moveY = imgConfig.y ?? 0;
    
    // [수정됨] 마진 대신 translate를 사용하여 이동, 확대, 회전을 한 번에 처리합니다.
    // 순서: 이동(translate) -> 확대(scale) -> 회전(rotate)
    let imgTransformString = `translate(${moveX}px, ${moveY}px) scale(${imgZoom}) rotate(${imgInnerRotation}deg)`;

    // shape 설정에 따라 부모 div 회전
    if (config.shape === 'diamond') {
        rotation = parseInt(config.rotation) || 0; 
    } else {
        rotation = parseInt(config.rotation) || 0;
    }

    // 이미지에 transform 적용
    $img.css('transform', imgTransformString); 
    
    // 중요: 기존의 마진 이동 방식이 충돌하지 않도록 0으로 초기화합니다.
    $img.css('object-position', `50% 50%`);
    $img.css('margin-left', '0px'); 
    $img.css('margin-top', '0px'); 

    // 팝업 박스 자체의 크기와 회전 설정
    $popup.css({
        width: `${config.width}px`,
        height: `${config.height}px`,
        transform: `rotate(${rotation}deg)`
    });

    $popup.removeClass('square diamond circle').addClass(config.shape || 'square');
}


function applyPosToPopup(type) {
    const $popup = $(`#${type}-avatar-popup`);
    const pos = settings[`${type}Pos`];
    const config = settings[`${type}Config`]; 
    
    if (!$popup.length) return;

    
    if (!settings.autoPosAdjust && pos && pos.left !== 'auto') {
        $popup.css({
            top: pos.top + 'px',
            left: pos.left + 'px',
        });
    } else if (settings.autoPosAdjust) {
        
        
        adjustPosBasedOnViewport();
    }


    
    
    if ($popup.data('ui-draggable')) {
        $popup.draggable('destroy');
    }
    
    const isChar = (type === 'char');
    const posKey = isChar ? 'charPos' : 'personaPos';
    
    const dragCursorX = config.width / 2;
    const dragCursorY = config.height / 2;
    
    $popup.draggable({
        cursorAt: { left: dragCursorX, top: dragCursorY }, 
        containment: false,
        scroll: false,
        
        start: function() {
            isAvatarDragging = true; 
            
            hideAvatarConfigPanel();
        },
        stop: function(event, ui) {
            
            setTimeout(() => { isAvatarDragging = false; }, 0); 
            settings[posKey] = {
                top: ui.position.top,
                left: ui.position.left
            };
            
            
            settings.initialViewport = {
                width: window.innerWidth,
                height: window.innerHeight
            };
            
            saveSettingsDebounced();
        }
    });
}



function renderActiveStickers() {
    
    $('.sticker-popup').remove();
    hideStickerConfigPanel();

    settings.activeStickers.forEach(activeSticker => {
        const savedSticker = settings.savedStickers.find(s => s.id === activeSticker.stickerId);
        if (savedSticker) {
            const $popup = $(`
                <div id="${activeSticker.popupId}" class="sticker-popup" data-sticker-id="${savedSticker.id}">
                    <img src="${savedSticker.link}" alt="${savedSticker.name} Sticker">
                    <div class="sticker-flip-btn" title="좌우 반전">&#x21C6;</div>
                    <div class="sticker-delete-btn" title="캔버스에서 제거 (클릭)">
                        &times;
                    </div>
                </div>
            `);

            $('body').append($popup);
            
            
            $popup.css({
                top: activeSticker.top + 'px',
                left: activeSticker.left + 'px',
                transform: `rotate(${activeSticker.rotation || 0}deg)`,
                width: `${activeSticker.width || 100}px`, 
                height: `${activeSticker.height || 100}px`, 
                'z-index': activeSticker.zIndex || 1000 
            });
            
            
            const flipTransform = activeSticker.isFlipped ? 'scaleX(-1)' : 'none';
            $popup.find('img').css('transform', flipTransform);
            
            
            $popup.on('click', onStickerPopupClick);
            
            
            $popup.find('.sticker-flip-btn').on('click', function(e) {
                e.stopPropagation(); 
                const popupId = $(this).parent().attr('id');
                toggleStickerFlip(popupId);
            });
            
            
            $popup.find('.sticker-delete-btn').on('click', function(e) {
                e.stopPropagation(); 
                const popupId = $(this).parent().attr('id');
                const stickerName = savedSticker.name; 
                
                if (confirm(`스티커 [${stickerName}]을(를) 캔버스에서 제거하시겠습니까?`)) {
                    removeStickerFromCanvas(popupId);
                }
            });

            
            $popup.draggable({
                containment: false, 
                scroll: false,
                start: function() {
                    
                    hideStickerConfigPanel(); 
                },
                stop: function(event, ui) {
                    const popupId = $(this).attr('id');
                    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
                    if (activeStickerIndex > -1) {
                        settings.activeStickers[activeStickerIndex].top = ui.position.top;
                        settings.activeStickers[activeStickerIndex].left = ui.position.left;
                        
                        
                        if (settings.autoPosAdjust) {
                            settings.initialViewport = {
                                width: window.innerWidth,
                                height: window.innerHeight
                            };
                        }
                        
                        saveSettingsDebounced();
                    }
                }
            });
            
            
            $popup.on('contextmenu', function(e) {
                 e.preventDefault();
                 if(confirm(`스티커 [${savedSticker.name}]을(를) 캔버스에서 제거하시겠습니까?`)) {
                    removeStickerFromCanvas(activeSticker.popupId);
                 }
            });
        }
    });
    
    
    toggleClickIgnore(settings.ignoreClick);
    togglePopups(settings.enabled);
}


function toggleStickerFlip(popupId) {
    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
    if (activeStickerIndex === -1) return;
    
    
    const newState = !settings.activeStickers[activeStickerIndex].isFlipped;
    settings.activeStickers[activeStickerIndex].isFlipped = newState;
    
    
    const $img = $(`#${popupId}`).find('img');
    const transform = newState ? 'scaleX(-1)' : 'none';
    
    $img.css('transform', transform);
    
    saveSettingsDebounced();
}


function removeStickerFromCanvas(popupId) {
    settings.activeStickers = settings.activeStickers.filter(s => s.popupId !== popupId);
    $(`#${popupId}`).remove();
    hideStickerConfigPanel(); 
    saveSettingsDebounced();
}


function renderStickerList(searchQuery = '') {
    const $container = $('#sticker-list-container-settings');
    $container.empty();
    
    
    const query = searchQuery.trim().toLowerCase();
    
    
    const filteredStickers = settings.savedStickers.filter(sticker => {
        if (!query) return true; 
        return sticker.name.toLowerCase().includes(query);
    });
    
    
    $('#sticker-count-display').text(filteredStickers.length);

    if (filteredStickers.length === 0) {
        $container.append(`<div id="sticker-list-placeholder" style="font-size: 0.8rem; color: #999; display: flex; align-items: center;">${query ? '검색된 스티커가 없습니다.' : '저장된 스티커가 없습니다.'}</div>`);
        return;
    }

    
    filteredStickers.forEach(sticker => { 
        
        const itemHtml = `
            <div class="sticker-item" data-id="${sticker.id}" title="더블 클릭: 목록에서 영구 삭제">
                <div class="sticker-item-content">
                    <div class="sticker-name-area" data-id="${sticker.id}" title="단일 클릭: 이름 및 링크 수정"></div>
                    <div class="sticker-image-area"></div>
                    <img src="${sticker.link}" alt="${sticker.name} Preview" class="sticker-list-item-preview">
                    <div style="font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 3px;">${sticker.name}</div>
                </div>
                <div class="sticker-item-controls">
                    <button class="add-sticker-to-canvas" data-id="${sticker.id}" title="캔버스에 추가">+</button>
                    <button class="remove-sticker-from-canvas-btn" data-id="${sticker.id}" title="캔버스에서 1개 제거">-</button>
                </div>
            </div>
        `;
        $container.append(itemHtml);
    });

    
    $container.find('.add-sticker-to-canvas').on('click', onAddStickerToCanvas);
    $container.find('.remove-sticker-from-canvas-btn').on('click', onRemoveActiveStickerInstance); 
    
    
    $container.find('.sticker-name-area').on('click', onStickerItemClickToEdit); 
    
    
    $container.find('.sticker-item-content').on('dblclick', onDeleteStickerFromList); 
}




function loadSettingsUI() {
    $('#avatar_popups_enable_toggle').prop('checked', settings.enabled);
    $('#avatar_popups_ignore_click_toggle').prop('checked', settings.ignoreClick).on('change', onIgnoreClickToggle);
    
    $('#avatar_popups_ignore_char_click_toggle')
        .prop('checked', settings.ignoreCharClick)
        .prop('disabled', settings.ignoreClick)
        .on('change', onIgnoreCharClickToggle);

    $('#avatar_popups_ignore_sticker_click_toggle')
        .prop('checked', settings.ignoreStickerClick)
        .prop('disabled', settings.ignoreClick)
        .on('change', onIgnoreStickerClickToggle);
    
    $('#avatar_popups_auto_adjust_toggle').prop('checked', settings.autoPosAdjust).on('change', onAutoPosAdjustToggle);
    $('#avatar_popups_floating_toggle').prop('checked', settings.isFloating).on('change', onFloatToggle);
    
    if (settings.autoPosAdjust) {
        startAutoPosAdjustment();
    } else {
        stopAutoPosAdjustment();
    }
    
    
    ['char', 'persona'].forEach(type => {
        const config = settings[`${type}Config`];
        
        
        $(`#${type}-width-input`).val(config.width);
        $(`#${type}-height-input`).val(config.height);
        $(`#${type}-rotation-input`).val(config.rotation);
        $(`#${type}-image-override-input`).val(config.imageOverride);
        
        
        $(`#${type}-shape-select`).val(config.shape); 
        
        
        applyConfigToPopup(type);
        
        applyPosToPopup(type);
    });
    
    
    renderStickerList(); 
    renderActiveStickers(); 

    
    renderPresetList();
    updatePresetButtons();
    
    
    toggleClickIgnore(settings.ignoreClick);
    toggleFloating(settings.isFloating);
}


function onStickerItemClickToEdit(e) {
    
    
    
    if ($(e.target).closest('.sticker-item-controls').length) {
        return; 
    }
    
    const $item = $(this).closest('.sticker-item'); 
    const stickerId = parseInt($item.data('id'));
    const savedSticker = settings.savedStickers.find(s => s.id === stickerId);
    
    if (!savedSticker) return;
    
    const originalName = savedSticker.name;
    const originalLink = savedSticker.link;
    
    
    const newCombinedValue = prompt(
        `스티커 [${originalName}] 의 이름 및 링크를 수정합니다.\n\n` +
        `[현재 이름]: ${originalName}\n` + 
        `[현재 이미지 링크 (복붙 가능)]: ${originalLink}\n\n` +
        
        `1. 이름만 수정: 새 이름을 입력하세요.\n` + 
        `2. 이름/링크 모두 수정: "새이름|새링크" 형식으로 입력하세요.\n` +
        `*새 링크는 현재 링크를 복사/수정하거나, 새 링크를 붙여넣으세요.*\n\n` +
        
        `[취소]를 누르면 수정이 취소됩니다.`, 
        originalName
    );

    if (newCombinedValue === null) {
        
        return;
    }
    
    const input = newCombinedValue.trim();
    
    
    if (input === originalName || input === '') {
        return;
    }
    
    const parts = input.split('|');
    
    let finalName = originalName;
    let finalLink = originalLink;

    if (parts.length > 1) {
        
        const potentialName = parts[0].trim();
        const potentialLink = parts[1].trim();
        
        if (potentialName !== '') {
            finalName = potentialName;
        }
        
        
        if (potentialLink.startsWith('http')) { 
            finalLink = potentialLink;
        }
    } else {
        
        if (input !== originalName) {
             finalName = input;
        }
    }

    if (finalName === originalName && finalLink === originalLink) {
        
        return;
    }
    
    if (finalName === '') {
        alert('이름은 비워둘 수 없습니다. 수정이 취소됩니다.');
        return;
    }

    
    savedSticker.name = finalName;
    savedSticker.link = finalLink;
    
    
    renderStickerList($('#sticker-search-input').val()); 
    
    
    $(`.sticker-popup[data-sticker-id="${stickerId}"]`).find('img').attr('src', finalLink);
    
    
    saveSettingsDebounced();
    
    alert(`스티커 [${originalName}]이(가) 이름: [${finalName}], 링크: [${finalLink}] (으)로 수정되었습니다.`);
}


function toggleClickIgnore(isEnabled) {
    
    if (isEnabled) {
        
        const $popups = $('#char-avatar-popup, #persona-avatar-popup, .sticker-popup');
        $popups.addClass('ignore-click');
    } else {
        
        
        
        const $avatarPopups = $('#char-avatar-popup, #persona-avatar-popup');
        if (settings.ignoreCharClick) {
            $avatarPopups.addClass('ignore-click');
        } else {
            $avatarPopups.removeClass('ignore-click');
        }

        
        const $stickerPopups = $('.sticker-popup');
        if (settings.ignoreStickerClick) {
            $stickerPopups.addClass('ignore-click');
        } else {
            $stickerPopups.removeClass('ignore-click');
        }
    }
}


function onEnableToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.enabled = value;
    togglePopups(value);
    saveSettingsDebounced();
}

function onIgnoreClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreClick = value;
    toggleClickIgnore(value);
    saveSettingsDebounced();
    
    $('#avatar_popups_ignore_char_click_toggle').prop('disabled', value);
    $('#avatar_popups_ignore_sticker_click_toggle').prop('disabled', value);
}


function onIgnoreCharClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreCharClick = value;
    
    if (!settings.ignoreClick) { 
        toggleClickIgnore(false); 
    }
    saveSettingsDebounced();
}


function onIgnoreStickerClickToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.ignoreStickerClick = value;
    
    if (!settings.ignoreClick) { 
        toggleClickIgnore(false); 
    }
    saveSettingsDebounced();
}


function onAutoPosAdjustToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.autoPosAdjust = value;
    
    if (value) {
        startAutoPosAdjustment();
    } else {
        stopAutoPosAdjustment();
        
        applyPosToPopup('char'); 
        applyPosToPopup('persona'); 
    }
    
    saveSettingsDebounced();
}
function onFloatToggle(event) {
    const value = Boolean($(event.target).prop('checked'));
    settings.isFloating = value;
    toggleFloating(value); 
    saveSettingsDebounced();
}

function onAvatarConfigInput() {
    const $input = $(this);
    const type = $input.data('type'); 
    const key = $input.data('key');   
    
    let value = $input.val();
    
    if (key === 'width' || key === 'height') {
        value = parseInt(value) || 0;
        if (value < 10) value = 10; 
    } else if (key === 'rotation') {
        value = parseInt(value) || 0;
    } else {
        
        value = value.trim();
    }
    
    settings[`${type}Config`][key] = value;
    
    
    applyConfigToPopup(type);
    
    
    if (key === 'imageOverride' && !value) {
        updateAvatars();
    }

    
    applyPosToPopup(type);
    
    saveSettingsDebounced();
}


function onTabClick() {
    const $tab = $(this);
    const target = $tab.data('target');

    
    $('#avatar-persona-tab-container').find('.tab').removeClass('active').css({
        background: '#f1f1f1',
        borderColor: 'transparent'
    });
    $tab.addClass('active').css({
        background: 'var(--white-color, #FFFFFF)',
        borderColor: 'var(--accent-color, #EC407A)'
    });

    
    $('.avatar-controls-container').hide().removeClass('active');
    $(`#${target}`).show().addClass('active');
}


function onSaveNewSticker() {
    const name = $('#sticker-name-input').val().trim();
    const link = $('#sticker-image-link-input').val().trim();

    if (!name || !link) {
        alert('스티커 이름과 이미지 링크를 모두 입력해주세요.');
        return;
    }
    
    settings.stickerCounter++;
    settings.savedStickers.push({
        id: settings.stickerCounter,
        name: name,
        link: link
    });

    
    $('#sticker-name-input').val('');
    $('#sticker-image-link-input').val('');
    $('#add-sticker-input-popup').hide(); 
    $('#toggle-add-sticker-input-btn').text('새 스티커 팝업 저장 및 추가');
    
    renderStickerList($('#sticker-search-input').val()); 
    saveSettingsDebounced();
}


function onAddStickerToCanvas() {
    const stickerId = parseInt($(this).data('id'));
    const uniquePopupId = `sticker-${stickerId}-${Date.now()}`;
    
    
    settings.activeStickers.push({
        stickerId: stickerId,
        top: 100 + Math.random() * 200, 
        left: 100 + Math.random() * 200,
        width: 100, 
        height: 100, 
        rotation: 0,
        isFlipped: false, 
        zIndex: 1000, 
        popupId: uniquePopupId 
    });
    
    renderActiveStickers();
    if (settings.autoPosAdjust) {
        adjustPosBasedOnViewport(); 
    }
    
    saveSettingsDebounced();
}


function onRemoveActiveStickerInstance() {
    const stickerId = parseInt($(this).data('id'));
    
    
    const activeIndex = settings.activeStickers.slice().reverse().findIndex(s => s.stickerId === stickerId);
    
    if (activeIndex > -1) {
        
        const realIndex = settings.activeStickers.length - 1 - activeIndex;
        
        const popupIdToRemove = settings.activeStickers[realIndex].popupId;
        
        
        settings.activeStickers.splice(realIndex, 1);
        
        
        $(`#${popupIdToRemove}`).remove();
        
        hideStickerConfigPanel(); 
        saveSettingsDebounced();
    } else {
        alert('캔버스에 해당 스티커가 활성화되어 있지 않습니다.');
    }
}


function onDeleteStickerFromList(e) {
    
    if ($(e.target).closest('.sticker-item-controls').length) {
        e.stopPropagation(); 
        return; 
    }
    
    const stickerId = parseInt($(this).closest('.sticker-item').data('id'));
    const stickerIndex = settings.savedStickers.findIndex(s => s.id === stickerId);
    
    if (stickerIndex > -1) {
        const stickerName = settings.savedStickers[stickerIndex].name;
        
        if (confirm(`스티커 목록에서 [${stickerName}]을(를) 영구 삭제하고, 캔버스에 있는 모든 인스턴스를 제거하시겠습니까?`)) {
            
            
            settings.savedStickers.splice(stickerIndex, 1);
            
            
            settings.activeStickers = settings.activeStickers.filter(s => {
                if (s.stickerId === stickerId) {
                    $(`#${s.popupId}`).remove();
                    return false;
                }
                return true;
            });
            
            
            renderStickerList($('#sticker-search-input').val());
            
            hideStickerConfigPanel();
            saveSettingsDebounced();
        }
    }
}







function onStickerPopupClick(event) {
    event.stopPropagation(); 
    const $popup = $(this);
    const popupId = $popup.attr('id');
    const activeSticker = settings.activeStickers.find(s => s.popupId === popupId);
    
    if (!activeSticker) return;

    
    currentEditingStickerPopupId = popupId;
    
    
    showStickerConfigPanel(activeSticker);
}



function updateStickerConfig(popupId, key, value) {
    const activeStickerIndex = settings.activeStickers.findIndex(s => s.popupId === popupId);
    if (activeStickerIndex === -1) return;

    
    const $popup = $(`#${popupId}`);
    if ($popup.length) {
        if (key === 'rotation') {
            settings.activeStickers[activeStickerIndex].rotation = value;
            $popup.css('transform', `rotate(${value}deg)`);
        } else if (key === 'width') { 
            settings.activeStickers[activeStickerIndex].width = value;
            settings.activeStickers[activeStickerIndex].height = value;
            $popup.css({
                'width': `${value}px`,
                'height': `${value}px`
            });
        } else if (key === 'zIndex') { 
            settings.activeStickers[activeStickerIndex].zIndex = value;
            $popup.css('z-index', value);
        }
    }
    
    saveSettingsDebounced();
}


function createStickerConfigPanel() {
    if ($('#sticker-config-panel').length) return;

    const panelHtml = `
        <div id="sticker-config-panel" class="st-floating-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; cursor: move;">
                <h4 style="margin: 0; font-size: 1rem;">🖼️ 스티커 설정</h4>
                <button id="close-sticker-config-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; padding: 0;">&times;</button>
            </div>
            
            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">사이즈 (px) [W=H]</label>
                <input type="number" id="sticker-size-input" class="sticker-config-input" data-key="width" min="10" placeholder="100" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>
            
            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">회전각 (°)</label>
                <input type="number" id="sticker-rotation-input" class="sticker-config-input" data-key="rotation" placeholder="0" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>

            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">레이어 순서 (Z-index)</label>
                <input type="number" id="sticker-zindex-input" class="sticker-config-input" data-key="zIndex" placeholder="1000" style="width: 100%; padding: 8px; border: 1px solid var(--border-color); border-radius: 5px; margin-bottom: 10px;">
            </div>
        </div>
    `;

    $('body').append(panelHtml);
    const $panel = $('#sticker-config-panel');
    
    
    $panel.draggable({
        handle: 'div:first-child', 
        containment: 'window', 
        scroll: false,
        stop: function(event, ui) {
            
            stickerPanelPos.top = ui.position.top;
            stickerPanelPos.left = ui.position.left;
        }
    });
    
    
    $('#close-sticker-config-btn').on('click', hideStickerConfigPanel);
    
    $('.sticker-config-input').on('input', function() {
        if (!currentEditingStickerPopupId) return;

        const $input = $(this);
        const key = $input.data('key');
        let value = parseInt($input.val());
        
        if (isNaN(value)) {
            
            value = (key === 'width' || key === 'height') ? 10 : 0;
        }

        
        if (key === 'width') { 
            value = Math.max(10, value);
        }
        
        updateStickerConfig(currentEditingStickerPopupId, key, value);
    });
}


function showStickerConfigPanel(activeSticker) {
    if (!$('#sticker-config-panel').length) {
        createStickerConfigPanel();
    }
    
    const $panel = $('#sticker-config-panel');

    
    $('#sticker-size-input').val(activeSticker.width);
    $('#sticker-rotation-input').val(activeSticker.rotation);
    
    $('#sticker-zindex-input').val(activeSticker.zIndex || 1000);
    
    
    if (stickerPanelPos.top === -1 || stickerPanelPos.left === -1) {
        
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        
        const panelWidth = $panel.outerWidth();
        const panelHeight = $panel.outerHeight();
        
        const centeredTop = (windowHeight / 2) - (panelHeight / 2);
        const centeredLeft = (windowWidth / 2) - (panelWidth / 2);
        
        $panel.css({
            top: centeredTop + 'px',
            left: centeredLeft + 'px'
        });
        
        
        stickerPanelPos.top = centeredTop;
        stickerPanelPos.left = centeredLeft;

    } else {
        
        $panel.css({
            top: stickerPanelPos.top + 'px',
            left: stickerPanelPos.left + 'px'
        });
    }

    
    $panel.show();
    
    
    $('.sticker-popup').removeClass('editing');
    $(`#${activeSticker.popupId}`).addClass('editing');
}


function hideStickerConfigPanel() {
    hideAvatarConfigPanel(); 
    $('#sticker-config-panel').hide();
    currentEditingStickerPopupId = null;
    $('.sticker-popup').removeClass('editing'); 
}


function onAvatarPopupClick(event) {
    event.stopPropagation(); 
    const $popup = $(event.currentTarget); 
    const popupId = $popup.attr('id');
    const type = (popupId === 'char-avatar-popup') ? 'char' : 'persona';
    
    if (!type) return;

    
    
    
    hideStickerConfigPanel(); 
    
    
    currentEditingAvatarType = type;
    
    
    showAvatarConfigPanel(type);
}






function createAvatarConfigPanel() {
    if ($('#avatar-config-panel').length) return;

    
    const panelHtml = `
        <div id="avatar-config-panel" class="st-floating-panel">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #ddd; padding-bottom: 5px; margin-bottom: 10px; cursor: move;">
                <h4 style="margin: 0; font-size: 1rem;">🖼️ 이미지 조정</h4>
                <button id="close-avatar-config-btn" style="background: none; border: none; font-size: 1.2rem; cursor: pointer; color: #888; padding: 0;">&times;</button>
            </div>
            
            <div class="control-group" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div class="dpad-container">
                    <button class="dpad-btn" id="dpad-up" data-axis="y" data-val="-1" title="위로 (Y-)">▲</button>
                    <button class="dpad-btn" id="dpad-left" data-axis="x" data-val="-1" title="왼쪽으로 (X-)">◄</button>
                    <div class="dpad-center"></div>
                    <button class="dpad-btn" id="dpad-right" data-axis="x" data-val="1" title="오른쪽으로 (X+)">►</button>
                    <button class="dpad-btn" id="dpad-down" data-axis="y" data-val="1" title="아래로 (Y+)">▼</button>
                </div>
                
                <div style="flex-grow: 1; margin-left: 10px;">
                    <label style="font-size: 0.8rem; margin-bottom: 5px; display: block;">D-Pad 이동량 (%)</label>
                    <select id="avatar-adjust-dpad-step" style="width: 100%; padding: 5px; border: 1px solid #d0d0d0; border-radius: 4px;">
                        <option value="1">1%</option>
                        <option value="5" selected>5%</option>
                        <option value="10">10%</option>
                    </select>
                </div>
            </div>

            <div class="control-group">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">확대/축소 (Zoom)</label>
                <div style="display: flex; align-items: center;">
                    <input type="range" id="avatar-adjust-zoom-slider" class="avatar-adjust-input" data-key="zoom" min="0.5" max="5" step="0.1" style="width: 70%; margin-right: 10px;">
                    <input type="number" id="avatar-adjust-zoom-input" class="avatar-adjust-input" data-key="zoom" min="0.5" max="5" step="0.1" style="width: 30%;">
                </div>
            </div>

            <div class="control-group" style="margin-top: 10px;">
                <label style="display: block; font-size: 0.9rem; margin-bottom: 5px;">이미지 회전 (°)</label>
                <div style="display: flex; align-items: center;">
                    <input type="range" id="avatar-adjust-rotation-slider" class="avatar-adjust-input" data-key="rotation" min="-180" max="180" step="1" style="width: 70%; margin-right: 10px;">
                    <input type="number" id="avatar-adjust-rotation-input" class="avatar-adjust-input" data-key="rotation" min="-180" max="180" step="1" style="width: 30%;">
                </div>
            </div>
            
            <div class="control-group" style="margin-top: 15px; text-align: center;">
                <button id="avatar-adjust-reset-btn" style="width: 100%; padding: 8px; background: #f0f0f0; border: 1px solid #ccc; border-radius: 5px; cursor: pointer; transition: background-color 0.1s ease;">조정값 초기화</button>
            </div>
        </div>
    `;

    $('body').append(panelHtml);
    const $panel = $('#avatar-config-panel');
    
    
    $panel.draggable({
        handle: 'div:first-child',
        containment: 'window', 
        scroll: false,
        stop: function(event, ui) {
            avatarPanelPos.top = ui.position.top;
            avatarPanelPos.left = ui.position.left;
        }
    });
    
    
    $('#close-avatar-config-btn').on('click', hideAvatarConfigPanel);
    

	
    
    $('.avatar-adjust-input').on('input', function() {
        if (!currentEditingAvatarType) return;
        
        const $input = $(this);
        const key = $input.data('key'); 
        let value = parseFloat($input.val());
        
        if (isNaN(value)) {
            value = (key === 'zoom') ? 1 : 0;
        }
        
        
        if ($input.is('[type="range"]')) {
            $(`#avatar-adjust-${key}-input`).val(value);
        } else {
            $(`#avatar-adjust-${key}-slider`).val(value);
        }
        
        
        settings[`${currentEditingAvatarType}Config`].imageAdjust[key] = value;
        
        applyConfigToPopup(currentEditingAvatarType);
        saveSettingsDebounced();
    });
    
    
    $('#avatar-adjust-reset-btn').on('click', function() {
        if (!currentEditingAvatarType) return;
        
        const defaultConfig = DEFAULT_SETTINGS.charConfig.imageAdjust; 
        settings[`${currentEditingAvatarType}Config`].imageAdjust = JSON.parse(JSON.stringify(defaultConfig));
        
        
        $('#avatar-adjust-zoom-slider, #avatar-adjust-zoom-input').val(defaultConfig.zoom);
        $('#avatar-adjust-rotation-slider, #avatar-adjust-rotation-input').val(defaultConfig.rotation);
        
        applyConfigToPopup(currentEditingAvatarType);
        saveSettingsDebounced();
    });

    
    $('#avatar-adjust-reset-btn').hover(
        function() { $(this).css('background-color', '#e0e0e0'); },
        function() { $(this).css('background-color', '#f0f0f0'); }
    );
	$('#avatar-config-panel').on('click', '.dpad-btn', function() {
		if (!currentEditingAvatarType) return;
		const $btn = $(this);
		const axis = $btn.data('axis'); // 'x' 또는 'y'
		const dir = parseInt($btn.data('val')); // -1 (상/좌) 또는 1 (하/우)
		
		// 이동량 설정값 가져오기 (기본값 5. 픽셀 조정을 위해 * 2)
		const step = (parseInt($('#avatar-adjust-dpad-step').val()) || 5) * 2; 
		
		// 현재 설정 가져오기
		let config = settings[`${currentEditingAvatarType}Config`];
		if (!config.imageAdjust) {
			config.imageAdjust = { x: 0, y: 0, zoom: 1, rotation: 0 };
		}
		
		let currentVal = config.imageAdjust[axis] || 0; // x 또는 y 값
		
        // X축 (좌우) 또는 Y축 (상하) 값만 변경합니다.
		if (axis === 'y' || axis === 'x') {
			currentVal += dir * step; 
		}
		
		// 값 저장 및 적용 (축에 해당하는 값만 변경합니다)
        // 이 로직은 imageAdjust.zoom 값을 건드리지 않습니다.
		settings[`${currentEditingAvatarType}Config`].imageAdjust[axis] = currentVal; 
		applyConfigToPopup(currentEditingAvatarType); 
		saveSettingsDebounced();
	});
}


function showAvatarConfigPanel(type) {
    if (!$('#avatar-config-panel').length) {
        createAvatarConfigPanel();
    }
    
    const $panel = $('#avatar-config-panel');
    const config = settings[`${type}Config`].imageAdjust;

    
    $('#avatar-adjust-zoom-slider, #avatar-adjust-zoom-input').val(config.zoom || 1);
    $('#avatar-adjust-rotation-slider, #avatar-adjust-rotation-input').val(config.rotation || 0);
    
    
    if (avatarPanelPos.top === -1 || avatarPanelPos.left === -1) {
        const windowWidth = $(window).width();
        const windowHeight = $(window).height();
        const panelWidth = $panel.outerWidth();
        const panelHeight = $panel.outerHeight();
        const centeredTop = Math.max(0, (windowHeight / 2) - (panelHeight / 2));
        const centeredLeft = Math.max(0, (windowWidth / 2) - (panelWidth / 2));
        
        $panel.css({ top: centeredTop + 'px', left: centeredLeft + 'px' });
        avatarPanelPos.top = centeredTop;
        avatarPanelPos.left = centeredLeft;
    } else {
        $panel.css({ top: avatarPanelPos.top + 'px', left: avatarPanelPos.left + 'px' });
    }

    
    $panel.show();
    
    
    $('.avatar-popup').removeClass('editing-avatar');
    $(`#${type}-avatar-popup`).addClass('editing-avatar');
}


function hideAvatarConfigPanel() {
    $('#avatar-config-panel').hide();
    currentEditingAvatarType = null;
    $('.avatar-popup').removeClass('editing-avatar'); 
}



function renderPresetList() {
    const $select = $('#preset-select-dropdown');
    const selectedPreset = $select.val();
    $select.empty();
    
    $select.append('<option value="" data-preset="none" disabled>저장된 프리셋을 선택하세요...</option>');

    Object.keys(settings.presets).forEach(name => {
        $select.append(`<option value="${name}">${name}</option>`);
    });
    
    if (selectedPreset && settings.presets[selectedPreset]) {
        $select.val(selectedPreset);
    } else {
        $select.val('');
    }
}

function onSavePreset() {
    const presetName = $('#preset-name-input').val().trim();
    if (!presetName) {
        alert('프리셋 이름을 입력해주세요.');
        return;
    }
    if (settings.presets[presetName] && !confirm(`프리셋 [${presetName}]이(가) 이미 존재합니다. 덮어쓰시겠습니까?`)) {
        return;
    }

    
    const currentPresetData = {
        charPos: JSON.parse(JSON.stringify(settings.charPos)),       
        personaPos: JSON.parse(JSON.stringify(settings.personaPos)), 
        charConfig: JSON.parse(JSON.stringify(settings.charConfig)),
        personaConfig: JSON.parse(JSON.stringify(settings.personaConfig)),
        activeStickers: JSON.parse(JSON.stringify(settings.activeStickers)),
    };

    settings.presets[presetName] = currentPresetData;
    
    alert(`프리셋 [${presetName}]이(가) 저장되었습니다.`);
    $('#preset-name-input').val('');
    renderPresetList();
    saveSettingsDebounced();
}

function onLoadPreset() {
    const presetName = $('#preset-select-dropdown').val();
    if (!presetName || !settings.presets[presetName]) return;
    
    const preset = settings.presets[presetName];

    
    settings.charPos = JSON.parse(JSON.stringify(preset.charPos));
    settings.personaPos = JSON.parse(JSON.stringify(preset.personaPos));
    
    settings.charConfig = JSON.parse(JSON.stringify(preset.charConfig));
    settings.personaConfig = JSON.parse(JSON.stringify(preset.personaConfig));
    settings.activeStickers = JSON.parse(JSON.stringify(preset.activeStickers));
    
    
    loadSettingsUI(); 

    alert(`프리셋 [${presetName}]을(를) 불러왔습니다.`);
    saveSettingsDebounced();
}

function onDeletePreset() {
    const presetName = $('#preset-select-dropdown').val();
    if (!presetName || !settings.presets[presetName]) return;

    if (confirm(`프리셋 [${presetName}]을(를) 삭제하시겠습니까?`)) {
        delete settings.presets[presetName];
        renderPresetList();
        updatePresetButtons();
        alert(`프리셋 [${presetName}]이(가) 삭제되었습니다.`);
        saveSettingsDebounced();
    }
}

function updatePresetButtons() {
    const selected = $('#preset-select-dropdown').val();
    const isDisabled = !selected || selected === '기본 설정';
    $('#load-preset-btn').prop('disabled', !selected);
    $('#delete-preset-btn').prop('disabled', isDisabled);
}




function togglePopups(isEnabled) {
    const displayStyle = isEnabled ? '' : 'none';
    $('#char-avatar-popup').css('display', displayStyle);
    $('#persona-avatar-popup').css('display', displayStyle);
    
    
    $('.sticker-popup').css('display', displayStyle);
}


function createPopup(id, title) {
    if ($(`#${id}`).length) return;

    const $popup = $(`
        <div id="${id}" class="avatar-popup">
            <img src="${DEFAULT_AVATAR_PATH}" alt="${title} Avatar" title="${title} Avatar" data-type="${title.toLowerCase()}">
        </div>
    `);

    $('body').append($popup);
    
    const isChar = (id === 'char-avatar-popup');
    const type = isChar ? 'char' : 'persona';
    
    
    
    
    
    
    
    
    applyConfigToPopup(type);
    
    
    applyPosToPopup(type); 
    
    
    

    $popup.on('click', function(e) {
        
        if (isAvatarDragging || $popup.hasClass('ignore-click')) {
            isAvatarDragging = false; 
            return; 
        }
        onAvatarPopupClick(e);
    });
}

async function updateAvatars() {
    if (!settings.enabled) return;
    
    const currentCharCard = characters[this_chid]; 
    let charPath = DEFAULT_AVATAR_PATH;
    if (currentCharCard && currentCharCard.avatar) {
        charPath = `/thumbnail?type=avatar&file=${currentCharCard.avatar}`;
    }
    if (!settings.charConfig.imageOverride) {
        $('#char-avatar-popup img').attr('src', charPath).show();
    }
    
    let personaPath = DEFAULT_AVATAR_PATH;
    const personaFileName = user_avatar;
    if (personaFileName) {
        if (typeof getThumbnailUrl === 'function') {
            personaPath = getThumbnailUrl('persona', personaFileName, true); 
        } else {
            personaPath = `/thumbnail?type=persona&file=${personaFileName}`; 
        }
    }
    if (!settings.personaConfig.imageOverride) {
        $('#persona-avatar-popup img').attr('src', personaPath).show();
    }
}

function initializePopups() {
    createPopup('char-avatar-popup', 'Character');
    createPopup('persona-avatar-popup', 'Persona');
    
    togglePopups(settings.enabled);
    updateAvatars();

    $(document).on('change', '#character_select', () => {
        setTimeout(updateAvatars, 200); 
    });
    eventSource.on(event_types.SETTINGS_UPDATED, updateAvatars);
    eventSource.on(event_types.CHAT_CHANGED, updateAvatars);
}


jQuery(async () => {
    initializePopups(); 
    createStickerConfigPanel(); 
	createAvatarConfigPanel();
    try {
        const settingsHtml = await $.get(`${extensionFolderPath}/settings.html`);
		$("#extensions_settings2").append(settingsHtml);
        
        
        $('#avatar_popups_enable_toggle').on('change', onEnableToggle);
        $('#avatar_popups_ignore_click_toggle').on('change', onIgnoreClickToggle); 
        
        $('#avatar_popups_auto_adjust_toggle').on('change', onAutoPosAdjustToggle);
        
        
        $('.avatar-config-input').on('input', onAvatarConfigInput);

        
        $('#avatar-persona-tab-container').find('.tab').on('click', onTabClick);
        
        
        $('#toggle-add-sticker-input-btn').on('click', function() {
            const $popup = $('#add-sticker-input-popup');
            const isHidden = $popup.is(':hidden');
            $popup.toggle();
            $(this).text(isHidden ? '👆 스티커 정보 입력 창 닫기' : '새 스티커 팝업 저장 및 추가');
        });
        $('#save-new-sticker-btn').on('click', onSaveNewSticker);
		
        $('#sticker-search-input').on('input', function() {
            const query = $(this).val();
            renderStickerList(query);
        });
        
        
        $('#save-preset-btn').on('click', onSavePreset);
        
        
        $('#save-preset-btn').on('click', onSavePreset);
        $('#load-preset-btn').on('click', onLoadPreset);
        $('#delete-preset-btn').on('click', onDeletePreset);
        $('#preset-select-dropdown').on('change', updatePresetButtons);

        
        loadSettingsUI();
        
    } catch (error) {
        console.warn(`[${extensionName}] settings.html 불러오기 실패`, error);
    }

    console.log('AvatarPopups extension initialized.');
});