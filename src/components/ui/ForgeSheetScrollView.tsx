import React, { useState } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { ForgeBottomSheetDragArea, useForgeSheetKeyboardVisible } from './ForgeBottomSheet';

/** Compact sheets drag as a card; only overflowing content owns a scroll gesture. */
export const ForgeSheetScrollView = React.forwardRef<
  ScrollView,
  Omit<ScrollViewProps, 'horizontal'> & { dragToDismiss?: boolean }
>(
  (
    {
      children,
      contentContainerStyle,
      onLayout,
      onContentSizeChange,
      style,
      dragToDismiss = true,
      ...props
    },
    ref,
  ) => {
    const keyboardVisible = useForgeSheetKeyboardVisible();
    const [viewport, setViewport] = useState(0);
    const [content, setContent] = useState(0);
    const overflowing = viewport > 0 && content > viewport + 1;
    const body = <View style={contentContainerStyle}>{children}</View>;
    return (
      <ScrollView
        keyboardShouldPersistTaps="handled"
        {...props}
        ref={ref}
        style={[{ flexShrink: 1 }, style]}
        scrollEnabled={overflowing}
        bounces={false}
        alwaysBounceVertical={false}
        onLayout={(event) => {
          setViewport(event.nativeEvent.layout.height);
          onLayout?.(event);
        }}
        onContentSizeChange={(width, height) => {
          setContent(height);
          onContentSizeChange?.(width, height);
        }}
      >
        {dragToDismiss ? (
          <ForgeBottomSheetDragArea enabled={!overflowing && !keyboardVisible}>{body}</ForgeBottomSheetDragArea>
        ) : (
          body
        )}
      </ScrollView>
    );
  },
);
ForgeSheetScrollView.displayName = 'ForgeSheetScrollView';
