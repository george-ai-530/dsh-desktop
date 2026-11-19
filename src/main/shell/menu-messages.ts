import { desktopLocale, type DesktopLocale } from '../../shared/desktop-locale'

const en = {
  about: 'About COWIN Harness Desktop', restart: 'Restart',
  edit: 'Edit', undo: 'Undo', redo: 'Redo', cut: 'Cut', copy: 'Copy', copyAction: 'Copy', paste: 'Paste', selectAll: 'Select All', window: 'Window', minimize: 'Minimize', close: 'Close',
  hide: 'Hide {app}', hideOthers: 'Hide Others', showAll: 'Show All', quitApp: 'Quit {app}', application: 'Application', exit: 'Exit', view: 'View', reload: 'Reload', actualSize: 'Actual Size', zoomIn: 'Zoom In', zoomOut: 'Zoom Out', fullscreen: 'Toggle Full Screen', delete: 'Delete', zoomCurrent: 'Actual Size (now {zoom})'
}

type MenuMessages = Record<keyof typeof en, string>
export const menuMessages: Record<DesktopLocale, MenuMessages> = {
  en,
  zh: {
    about: '关于 COWIN Harness Desktop', restart: '重启', edit: '编辑', undo: '撤销', redo: '重做', cut: '剪切', copy: '拷贝', copyAction: '复制', paste: '粘贴', selectAll: '全选', window: '窗口', minimize: '最小化', close: '关闭', hide: '隐藏 {app}', hideOthers: '隐藏其他', showAll: '全部显示', quitApp: '退出 {app}', application: '应用', exit: '退出', view: '视图', reload: '重新加载', actualSize: '实际大小', zoomIn: '放大', zoomOut: '缩小', fullscreen: '切换全屏', delete: '删除', zoomCurrent: '实际大小（当前 {zoom}）'
  },
  ja: {
    about: 'COWIN Harness Desktop について', restart: '再起動', edit: '編集', undo: '取り消す', redo: 'やり直す', cut: '切り取り', copy: 'コピー', copyAction: 'コピー', paste: '貼り付け', selectAll: 'すべて選択', window: 'ウィンドウ', minimize: '最小化', close: '閉じる', hide: '{app} を隠す', hideOthers: 'ほかを隠す', showAll: 'すべて表示', quitApp: '{app} を終了', application: 'アプリケーション', exit: '終了', view: '表示', reload: '再読み込み', actualSize: '実際のサイズ', zoomIn: '拡大', zoomOut: '縮小', fullscreen: 'フルスクリーン切り替え', delete: '削除', zoomCurrent: '実際のサイズ（現在 {zoom}）'
  },
  es: {
    about: 'Acerca de COWIN Harness Desktop', restart: 'Reiniciar', edit: 'Editar', undo: 'Deshacer', redo: 'Rehacer', cut: 'Cortar', copy: 'Copiar', copyAction: 'Copiar', paste: 'Pegar', selectAll: 'Seleccionar todo', window: 'Ventana', minimize: 'Minimizar', close: 'Cerrar', hide: 'Ocultar {app}', hideOthers: 'Ocultar otras', showAll: 'Mostrar todo', quitApp: 'Salir de {app}', application: 'Aplicación', exit: 'Salir', view: 'Ver', reload: 'Recargar', actualSize: 'Tamaño real', zoomIn: 'Acercar', zoomOut: 'Alejar', fullscreen: 'Alternar pantalla completa', delete: 'Eliminar', zoomCurrent: 'Tamaño real (actual: {zoom})'
  },
  fr: {
    about: 'À propos de COWIN Harness Desktop', restart: 'Redémarrer', edit: 'Édition', undo: 'Annuler', redo: 'Rétablir', cut: 'Couper', copy: 'Copier', copyAction: 'Copier', paste: 'Coller', selectAll: 'Tout sélectionner', window: 'Fenêtre', minimize: 'Réduire', close: 'Fermer', hide: 'Masquer {app}', hideOthers: 'Masquer les autres', showAll: 'Tout afficher', quitApp: 'Quitter {app}', application: 'Application', exit: 'Quitter', view: 'Affichage', reload: 'Recharger', actualSize: 'Taille réelle', zoomIn: 'Agrandir', zoomOut: 'Réduire', fullscreen: 'Basculer en plein écran', delete: 'Supprimer', zoomCurrent: 'Taille réelle (actuelle : {zoom})'
  },
  de: {
    about: 'Über COWIN Harness Desktop', restart: 'Neu starten', edit: 'Bearbeiten', undo: 'Rückgängig', redo: 'Wiederholen', cut: 'Ausschneiden', copy: 'Kopieren', copyAction: 'Kopieren', paste: 'Einfügen', selectAll: 'Alles auswählen', window: 'Fenster', minimize: 'Minimieren', close: 'Schließen', hide: '{app} ausblenden', hideOthers: 'Andere ausblenden', showAll: 'Alle einblenden', quitApp: '{app} beenden', application: 'Anwendung', exit: 'Beenden', view: 'Ansicht', reload: 'Neu laden', actualSize: 'Originalgröße', zoomIn: 'Vergrößern', zoomOut: 'Verkleinern', fullscreen: 'Vollbild umschalten', delete: 'Löschen', zoomCurrent: 'Originalgröße (aktuell {zoom})'
  },
  ru: {
    about: 'О COWIN Harness Desktop', restart: 'Перезапустить', edit: 'Правка', undo: 'Отменить', redo: 'Повторить', cut: 'Вырезать', copy: 'Копировать', copyAction: 'Копировать', paste: 'Вставить', selectAll: 'Выбрать всё', window: 'Окно', minimize: 'Свернуть', close: 'Закрыть', hide: 'Скрыть {app}', hideOthers: 'Скрыть остальные', showAll: 'Показать все', quitApp: 'Завершить {app}', application: 'Приложение', exit: 'Выход', view: 'Вид', reload: 'Перезагрузить', actualSize: 'Исходный размер', zoomIn: 'Увеличить', zoomOut: 'Уменьшить', fullscreen: 'Переключить полноэкранный режим', delete: 'Удалить', zoomCurrent: 'Исходный размер (сейчас {zoom})'
  },
  pt: {
    about: 'Sobre o COWIN Harness Desktop', restart: 'Reiniciar', edit: 'Editar', undo: 'Desfazer', redo: 'Refazer', cut: 'Recortar', copy: 'Copiar', copyAction: 'Copiar', paste: 'Colar', selectAll: 'Selecionar tudo', window: 'Janela', minimize: 'Minimizar', close: 'Fechar', hide: 'Ocultar {app}', hideOthers: 'Ocultar outros', showAll: 'Mostrar tudo', quitApp: 'Encerrar {app}', application: 'Aplicativo', exit: 'Sair', view: 'Exibir', reload: 'Recarregar', actualSize: 'Tamanho real', zoomIn: 'Ampliar', zoomOut: 'Reduzir', fullscreen: 'Alternar tela cheia', delete: 'Excluir', zoomCurrent: 'Tamanho real (atual: {zoom})'
  }
}

export function desktopMenuMessages(locale: string): MenuMessages {
  return menuMessages[desktopLocale(locale) ?? 'en']
}
