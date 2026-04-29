import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Users } from 'lucide-react';
import type { RootState } from '../../../store';
import { setGroups } from '../../../slices/whatsapp/whatsappSlice';
import * as waApi from '../../../services/whatsappApi';

interface GroupListProps {
  darkMode: boolean;
}

const GroupList: React.FC<GroupListProps> = ({ darkMode }) => {
  const dispatch = useDispatch();
  const { groups, sessionStatus } = useSelector((state: RootState) => state.whatsapp);

  useEffect(() => {
    if (sessionStatus === 'connected') {
      loadGroups();
    }
  }, [sessionStatus]);

  const loadGroups = async () => {
    try {
      const res = await waApi.getGroups();
      dispatch(setGroups(res.data.groups));
    } catch (err) {
      console.error('[GroupList] Error loading groups:', err);
    }
  };

  if (sessionStatus !== 'connected') {
    return (
      <div className="flex items-center justify-center py-12">
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          Conecta WhatsApp para ver tus grupos
        </p>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className={`text-sm ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
          No se encontraron grupos
        </p>
      </div>
    );
  }

  return (
    <div className="p-3 space-y-2">
      {groups.map(group => (
        <div
          key={group.id}
          className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${darkMode ? 'hover:bg-[#1A1D1F]' : 'hover:bg-gray-50'}`}
        >
          <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center text-white shrink-0">
            <Users size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <p className={`text-sm font-semibold m-0 truncate ${darkMode ? 'text-white' : 'text-gray-900'}`}>
              {group.subject}
            </p>
            <p className={`text-xs m-0 ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
              {group.participants} participantes
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

export default GroupList;
