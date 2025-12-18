import React from 'react';
import { useOrganization } from '../../hooks/useOrganization';

export const OrganizationInfo: React.FC = () => {
    const { organization, loading, error } = useOrganization();

    if (loading) {
        return (
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-600 dark:text-gray-400">Загрузка организации...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg">
                <p className="text-red-600 dark:text-red-400">Ошибка загрузки организации: {error}</p>
            </div>
        );
    }

    if (!organization) {
        return (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-yellow-600 dark:text-yellow-400">Организация не найдена</p>
            </div>
        );
    }

    return (
        <section className="p-6 bg-white dark:bg-gray-800 rounded-lg shadow-md">
            <h2 className="text-2xl font-bold mb-4 text-gray-800 dark:text-gray-100">Организация</h2>
            <div className="space-y-2">
                <div className="flex">
                    <span className="font-medium text-gray-600 dark:text-gray-400 w-32">Название:</span>
                    <span className="text-gray-800 dark:text-gray-200">{organization.name}</span>
                </div>
                {organization.shortName && (
                    <div className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-32">Краткое:</span>
                        <span className="text-gray-800 dark:text-gray-200">{organization.shortName}</span>
                    </div>
                )}
                {organization.inn && (
                    <div className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-32">ИНН:</span>
                        <span className="text-gray-800 dark:text-gray-200">{organization.inn}</span>
                    </div>
                )}
                {organization.kpp && (
                    <div className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-32">КПП:</span>
                        <span className="text-gray-800 dark:text-gray-200">{organization.kpp}</span>
                    </div>
                )}
                {organization.ogrn && (
                    <div className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-32">ОГРН:</span>
                        <span className="text-gray-800 dark:text-gray-200">{organization.ogrn}</span>
                    </div>
                )}
                {organization.address && (
                    <div className="flex">
                        <span className="font-medium text-gray-600 dark:text-gray-400 w-32">Адрес:</span>
                        <span className="text-gray-800 dark:text-gray-200">{organization.address}</span>
                    </div>
                )}
            </div>
        </section>
    );
};
