import React, { useState } from 'react';
import { ScrollView, View, type ScrollViewProps } from 'react-native';
import { ForgeBottomSheetDragArea } from './ForgeBottomSheet';

/** Compact sheets drag as a card; only overflowing content owns a scroll gesture. */
export const ForgeSheetScrollView = React.forwardRef<ScrollView, Omit<ScrollViewProps, 'horizontal'>>(
  ({ children, contentContainerStyle, onLayout, onContentSizeChange, style, ...props }, ref) => {
    const [viewport, setViewport] = useState(0);
    const [content, setContent] = useState(0);
    const overflowing = viewport > 0 && content > viewport + 1;
    const body = <View style={contentContainerStyle}>{children}</View>;
    return (
      <ScrollView
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
        <ForgeBottomSheetDragArea enabled={!overflowing}>{body}</ForgeBottomSheetDragArea>
      </ScrollView>
    );
  },
);
ForgeSheetScrollView.displayName = 'ForgeSheetScrollView';
