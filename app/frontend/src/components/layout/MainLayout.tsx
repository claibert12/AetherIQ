import React from 'react';
import {
  Box,
  Flex,
  useColorModeValue,
  Drawer,
  DrawerContent,
  useDisclosure,
  IconButton,
  HStack,
  VStack,
  Text,
  Icon,
  Link,
  Button,
} from '@chakra-ui/react';
import {
  FiHome,
  FiTrendingUp,
  FiCompass,
  FiSettings,
  FiHelpCircle,
  FiMenu,
  FiBell,
  FiUser,
  FiLogOut,
} from 'react-icons/fi';
import { Link as RouterLink } from 'react-router-dom';

interface NavItemProps {
  icon: any;
  children: React.ReactNode;
  to: string;
}

const NavItem = ({ icon, children, to }: NavItemProps) => {
  return (
    <Link
      as={RouterLink}
      to={to}
      style={{ textDecoration: 'none' }}
      _focus={{ boxShadow: 'none' }}
    >
      <Flex
        align="center"
        p="4"
        mx="4"
        borderRadius="lg"
        role="group"
        cursor="pointer"
        _hover={{
          bg: 'blue.400',
          color: 'white',
        }}
      >
        <Icon
          mr="4"
          fontSize="16"
          as={icon}
        />
        {children}
      </Flex>
    </Link>
  );
};

export const MainLayout = ({ children }: { children: React.ReactNode }) => {
  const { isOpen, onOpen, onClose } = useDisclosure();
  const colorModeValue = useColorModeValue('white', 'gray.900');

  return (
    <Box minH="100vh" bg={useColorModeValue('gray.50', 'gray.900')}>
      <SidebarContent
        onClose={() => onClose}
        display={{ base: 'none', md: 'block' }}
      />
      <Drawer
        isOpen={isOpen}
        placement="left"
        onClose={onClose}
        returnFocusOnClose={false}
        onOverlayClick={onClose}
        size="full"
      >
        <DrawerContent>
          <SidebarContent onClose={onClose} />
        </DrawerContent>
      </Drawer>
      {/* Mobile nav */}
      <Box ml={{ base: 0, md: 60 }} p="4">
        <Flex
          as="header"
          align="center"
          justify="space-between"
          w="full"
          px="4"
          bg={colorModeValue}
          borderBottomWidth="1px"
          borderColor={useColorModeValue('gray.200', 'gray.700')}
          h="14"
          position="sticky"
          top="0"
          zIndex="sticky"
        >
          <IconButton
            display={{ base: 'flex', md: 'none' }}
            onClick={onOpen}
            variant="outline"
            aria-label="open menu"
            icon={<FiMenu />}
          />
          <HStack spacing={{ base: '0', md: '6' }}>
            <IconButton
              size="lg"
              variant="ghost"
              aria-label="open menu"
              icon={<FiBell />}
            />
            <Flex align={'center'}>
              <IconButton
                size="lg"
                variant="ghost"
                aria-label="user menu"
                icon={<FiUser />}
              />
            </Flex>
          </HStack>
        </Flex>
        <Box as="main" p="4">
          {children}
        </Box>
      </Box>
    </Box>
  );
};

const SidebarContent = ({ onClose, ...rest }: any) => {
  return (
    <Box
      transition="3s ease"
      bg={useColorModeValue('white', 'gray.900')}
      borderRight="1px"
      borderRightColor={useColorModeValue('gray.200', 'gray.700')}
      w={{ base: 'full', md: 60 }}
      pos="fixed"
      h="full"
      {...rest}
    >
      <Flex h="20" alignItems="center" mx="8" justifyContent="space-between">
        <Text fontSize="2xl" fontFamily="monospace" fontWeight="bold">
          AetherIQ
        </Text>
      </Flex>
      <VStack spacing="4" align="stretch">
        <NavItem icon={FiHome} to="/">
          Dashboard
        </NavItem>
        <NavItem icon={FiTrendingUp} to="/analytics">
          Analytics
        </NavItem>
        <NavItem icon={FiCompass} to="/reports">
          Reports
        </NavItem>
        <NavItem icon={FiSettings} to="/settings">
          Settings
        </NavItem>
        <NavItem icon={FiHelpCircle} to="/support">
          Support
        </NavItem>
      </VStack>
    </Box>
  );
}; 